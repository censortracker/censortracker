import browser from './browser-api'
import ProxyManager from './proxy'
import type { CheckAttempt, ProxyCheck } from './proxy-check-data'
import { currentProxyCheck, proxyFingerprint } from './proxy-check-data'
import type { ProbeResult } from './proxy-check-network'
import { CHECK_TIMEOUT, CHECK_URLS, locateProxy, probeProxy } from './proxy-check-network'
import { recordProxyHealth, recoverableProxies } from './proxy-health'
import { readProxyState } from './proxy-list'
import type { ManagedProxy } from './proxy-record'
import { hasEndpoint, hasProxyAuth, proxyAuthSupported } from './proxy-record'
import { getProbeRoutes, mustUseDirect, proxyAllowed, setProbeRoute, withProxyLock } from './proxy-route'
import { requestFailure } from './request-diagnostics'
import { hasSiteRestriction } from './site-rules'
import type { StorageState } from './storage'
import { isStringArray } from './value'

interface CheckJob {
  controller: AbortController
  proxies: ManagedProxy[]
  completed: number
  automatic: boolean
  done?: Promise<void>
}

let job: CheckJob | null
const routeKeys: (keyof StorageState)[] = [
  'dataConsent', 'enableExtension', 'useProxy', 'proxies', 'selectedProxyIds',
  'ignoredHosts', 'localProxyURI', 'proxyServerURI', 'useLocalProxy',
  'localProxyAlive', 'siteCountryRules',
]
const runState = (current: CheckJob) => ({
  running: true,
  total: current.proxies.length,
  completed: current.completed,
  cancelled: current.controller.signal.aborted,
})

const restoreRouting = async () => {
  if (await proxyAllowed()) {
    if (!await ProxyManager.setProxyInBackground({ ping: false })) {
      throw new Error('Could not restore routing after checks')
    }
  } else {
    await ProxyManager.removeProxyInBackground()
  }
}

export const getProxyCheckState = async () => {
  const { proxies, builtin } = await readProxyState()
  const { proxyChecks, proxyCheckRun } = await browser.storage.local.get({
    proxyChecks: {}, proxyCheckRun: { running: false },
  })
  const checks: Record<string, ProxyCheck> = {}

  await Promise.all([builtin, ...proxies].map(async (proxy) => {
    const result = await currentProxyCheck(proxy, proxyChecks)

    if (result) {
      checks[proxy.id] = result
    }
  }))
  return {
    checks, run: job ? runState(job) : { ...proxyCheckRun, running: false },
  }
}

const checkOne = async (current: CheckJob,
  proxy: ManagedProxy,
  url: string,
  attempts: CheckAttempt[],
  canRetry: boolean) => {
  const { signal } = current.controller
  const hostname = new URL(url).hostname
  const fingerprint = await proxyFingerprint(proxy)
  let result: (ProbeResult & { status: 'ok' }) | { status: 'restricted' | 'unsupported' | 'auth' | 'failed' }

  if (!hasEndpoint(proxy) || proxy.restricted ||
    !proxyAuthSupported(proxy, browser.isFirefox)) {
    result = { status: proxy.restricted ? 'restricted' : 'unsupported' }
  } else {
    let prepared = false

    try {
      await withProxyLock(async () => {
        if (signal.aborted || !await proxyAllowed() ||
          await mustUseDirect(hostname)) {
          current.controller.abort()
          throw new Error('Proxy check cancelled')
        }
        setProbeRoute(hostname, proxy)
        if (!await ProxyManager.setProxyInBackground({ ping: false })) {
          throw new Error('Could not install check route')
        }
      })
      if (signal.aborted || !await proxyAllowed()) {
        current.controller.abort()
        return null
      }
      const route = getProbeRoutes()
        .find((probe) => probe.hostname === hostname)

      if (!route || !Number.isFinite(route.expiresAt) ||
        route.expiresAt - Date.now() < CHECK_TIMEOUT) {
        throw new Error('Check route expires before the request deadline')
      }
      prepared = true
      result = { ...await probeProxy(url, signal), status: 'ok' }
      attempts.push({ service: hostname, code: 'ok' })
    } catch (error) {
      result = {
        status: getProbeRoutes()
          .find((probe) => probe.hostname === hostname)?.authFailed
          ? 'auth' : 'failed',
      }
      let failure = prepared ? requestFailure(error) : { code: 'route-setup' }

      if (result.status === 'auth') {
        failure = { code: 'auth' }
      }
      attempts.push({ service: hostname, ...failure })
    } finally {
      await withProxyLock(async () => {
        setProbeRoute(hostname, null)
        await restoreRouting()
      })
    }
    if (result?.status === 'ok' && !signal.aborted) {
      result = await locateProxy(proxy, result, signal)
    }
  }
  if (!signal.aborted && canRetry && result.status === 'failed' &&
    attempts.at(-1)?.code !== 'route-setup') {
    return attempts
  }
  if (!signal.aborted && await proxyAllowed()) {
    await withProxyLock(async () => {
      const { proxies, builtin } = await readProxyState()
      const record = [builtin, ...proxies].find(({ id }) => id === proxy.id)

      if (!record || await proxyFingerprint(record) !== fingerprint ||
        signal.aborted) {
        return
      }
      const { proxyChecks } = await browser.storage.local.get({
        proxyChecks: {},
      })

      proxyChecks[proxy.id] = {
        ...result, attempts, fingerprint, checkedAt: Date.now(),
      }
      await browser.storage.local.set({ proxyChecks })
      if (result.status === 'ok' || (result.status === 'failed' &&
        attempts.at(-1)?.code !== 'route-setup' && !hasProxyAuth(proxy))) {
        await recordProxyHealth(proxy, result.status !== 'ok')
      }
      await ProxyManager.setProxyInBackground({ ping: false })
    })
  }
  return null
}

const runChecks = async (current: CheckJob, urls: string[]) => {
  let queues: {
    proxy: ManagedProxy;
    attempts: CheckAttempt[]
  }[][] = urls.map((url, index) => current.proxies
    .filter((proxy, position) => position % urls.length === index)
    .map((proxy) => ({ proxy, attempts: [] })))

  try {
    for (let round = 0; round < 2; round++) {
      const retries: typeof queues = urls.map(() => [])
      const roundQueues = queues

      await Promise.allSettled(urls.map(async (url, index) => {
        try {
          for (const { proxy, attempts } of roundQueues[index] || []) {
            if (current.controller.signal.aborted) {
              break
            }
            const retry = await checkOne(current, proxy, url, attempts,
              round === 0 && urls.length > 1)

            if (current.controller.signal.aborted) {
              break
            }
            if (retry) {
              retries[(index + 1) % urls.length]
                ?.push({ proxy, attempts: retry })
            } else {
              current.completed++
              await browser.storage.local.set({
                proxyCheckRun: runState(current),
              })
            }
          }
        } catch (error) {
          current.controller.abort()
          throw error
        }
      }))
      queues = retries
    }
  } finally {
    current.controller.abort()
    await withProxyLock(async () => {
      for (const { hostname } of getProbeRoutes()) {
        setProbeRoute(hostname, null)
      }
      await restoreRouting()
      await browser.storage.local.set({ proxyProbeActive: false })
    })
    await browser.storage.local.set({
      proxyCheckRun: {
        running: false,
        total: current.proxies.length,
        completed: current.completed,
        cancelled: current.completed < current.proxies.length,
      },
    })
    job = null
  }
}

export const startProxyChecks = async ({
  ids,
  automatic = false,
}: {
  ids?: unknown;
  automatic?: boolean
} = {
}) => {
  if (job) {
    throw new Error('A proxy check is already running')
  }
  const current: CheckJob = {
    controller: new AbortController(),
    proxies: [],
    completed: 0,
    automatic,
  }

  job = current
  try {
    const { proxyRecoveryEnabled } = await browser.storage.local.get({
      proxyRecoveryEnabled: false,
    })

    if (automatic && !proxyRecoveryEnabled) {
      throw new Error('Automatic checks are disabled')
    }
    if (!await proxyAllowed()) {
      throw new Error('Enable proxy use before checking')
    }
    const { proxies, builtin, selectedProxyIds } = await readProxyState()
    const catalog = [builtin, ...proxies]
    const available = new Set(catalog.map(({ id }) => id))

    if (ids !== undefined && (!isStringArray(ids) || ids.length > 5001 ||
      ids.some((id) => !available.has(id)))) {
      throw new Error('Invalid check selection')
    }
    current.proxies = catalog.filter(({ id }) =>
      !isStringArray(ids) || ids.includes(id))
    if (automatic) {
      const { proxyFailures, localProxyURI, proxyRecoveryEnabled: enabled } =
        await browser.storage.local.get({
          proxyFailures: {}, localProxyURI: null, proxyRecoveryEnabled: false,
        })

      current.proxies = enabled && !localProxyURI
        ? (await recoverableProxies(current.proxies.filter(({ id }) =>
          selectedProxyIds.includes(id)), proxyFailures)).slice(0, 4) : []
    }
    const urls = []
    const { siteCountryRules } = await browser.storage.local.get({
      siteCountryRules: {},
    })

    for (const url of CHECK_URLS) {
      const hostname = new URL(url).hostname

      if (!hasSiteRestriction(hostname, siteCountryRules) &&
        !await mustUseDirect(hostname)) {
        urls.push(url)
      }
    }
    if (urls.length === 0 || current.proxies.length === 0) {
      throw new Error('No proxies or permitted check services')
    }
    if (current.proxies.some(({ id }) => id === 'builtin')) {
      await ProxyManager.ping(true)
    }
    await browser.storage.local.set({
      proxyProbeActive: true, proxyCheckRun: runState(current),
    })
    current.done = runChecks(current, urls).catch(() => {
      current.controller.abort()
      job = null
      console.warn('Proxy check stopped; routing recovery may be required')
    })
    return runState(current)
  } catch (error) {
    current.controller.abort()
    job = null
    throw error
  }
}

export const stopProxyChecks = async () => {
  const current = job

  if (current) {
    current.controller.abort()
    await current.done
  }
}

export const registerProxyChecks = async () => {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && job?.automatic &&
      changes.proxyRecoveryEnabled?.newValue === false) {
      job.controller.abort()
    }
    if (area === 'local' && routeKeys.some((key) => changes[key])) {
      if (job) {
        job.controller.abort()
      }
    }
  })
  if (browser.proxy.settings.onChange) {
    browser.proxy.settings.onChange.addListener(({ levelOfControl }) => {
      if (job && levelOfControl !== 'controlled_by_this_extension') {
        job.controller.abort()
      }
    })
  }
  await withProxyLock(async () => {
    const { proxyProbeActive } = await browser.storage.local.get(
      'proxyProbeActive',
    )

    if (proxyProbeActive) {
      await restoreRouting()
      await browser.storage.local.set({
        proxyProbeActive: false,
        proxyCheckRun: { running: false, cancelled: true },
      })
    }
  })
}
