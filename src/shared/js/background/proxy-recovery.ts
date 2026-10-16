import browser from './browser-api'
import { normalizeHostname } from './hostname'
import ProxyManager from './proxy'
import { getProxyCheckState, startProxyChecks } from './proxy-check'
import { recordProxyHealth, recoverableProxies } from './proxy-health'
import { hasProxyAuth } from './proxy-record'
import { getProbeRoutes, proxyAllowed, withProxyLock } from './proxy-route'
import { synchronizeInBackground } from './server'
import type { StorageState } from './storage'

export interface ProxyErrorDetails {
  error?: string
  url?: string
  tabId?: number
  proxyInfo?: { host?: string; port?: number; type?: string }
}

export const RECOVERY_ALARM = 'proxy-recovery'
const recoveryKeys: (keyof StorageState)[] = [
  'dataConsent', 'proxyRecoveryEnabled', 'enableExtension', 'useProxy',
]
let recovering = false
const connectionErrors = new Set([
  'NS_ERROR_UNKNOWN_PROXY_HOST', 'NS_ERROR_PROXY_CONNECTION_REFUSED',
  'NS_ERROR_PROXY_BAD_GATEWAY', 'NS_ERROR_PROXY_GATEWAY_TIMEOUT',
  'ERR_PROXY_CONNECTION_FAILED',
  'ERR_SOCKS_CONNECTION_FAILED',
])

export const recoverProxy = async ({
  error,
  url,
  tabId,
  proxyInfo,
}: ProxyErrorDetails = {
}) => {
  const hostname = normalizeHostname(url)

  if (recovering || tabId === -1 || !hostname ||
    typeof error !== 'string' || !connectionErrors.has(error.replace(/^net::/, '')) ||
    getProbeRoutes().some((probe) => probe.hostname === hostname)) {
    return
  }
  recovering = true
  try {
    if (!await proxyAllowed()) {
      return
    }
    const route = await ProxyManager.getRouteForHost(hostname)

    if (route.type !== 'proxy') {
      return
    }
    const { proxyRecoveryAt = 0 } = await browser.storage.local.get('proxyRecoveryAt')

    if (Date.now() - proxyRecoveryAt < 30000) {
      return
    }
    const reportedHost = normalizeHostname(proxyInfo?.host) ||
      normalizeHostname(`[${proxyInfo?.host}]`)
    let failed = route.proxies.length === 1 ? route.proxies[0] : null

    if (proxyInfo) {
      const protocols: Record<string, string> = {
        http: 'HTTP', https: 'HTTPS', socks4: 'SOCKS4', socks: 'SOCKS5',
      }
      const matches = route.proxies.filter((proxy) =>
        proxy.host === reportedHost &&
        proxy.port === proxyInfo.port &&
        (!proxyInfo.type || proxy.protocol === protocols[proxyInfo.type]))

      failed = matches.length === 1 ? matches[0] : null
      if (!failed) {
        return
      }
    }
    await browser.storage.local.set({ proxyRecoveryAt: Date.now() })

    await withProxyLock(async () => {
      if (!await proxyAllowed()) {
        return
      }
      if (failed && failed.id !== 'local' &&
        !(failed.protocol === 'SOCKS5' && hasProxyAuth(failed))) {
        await recordProxyHealth(failed, true)
      }
      await ProxyManager.setProxyInBackground({ ping: false })
    })
    // Chromium does not report which pool endpoint failed. Do not blacklist
    // a guessed endpoint; a managed refresh can still supply a new address.
    const managed = (await ProxyManager.getSelectedProxies())
      .find(({ id }) => id === 'builtin')

    if (managed && route.proxies.some(({ id }) => id === 'builtin') &&
      await proxyAllowed()) {
      if (failed?.id === 'builtin') {
        const { currentProxyServer, badProxies } =
          await browser.storage.local.get({
            currentProxyServer: null, badProxies: [],
          })

        if (currentProxyServer && managed.host === failed.host &&
          managed.port === failed.port &&
          normalizeHostname(currentProxyServer) === failed.host &&
          !badProxies.includes(currentProxyServer)) {
          await browser.storage.local.set({
            badProxies: [...badProxies, currentProxyServer],
          })
        }
      }
      await synchronizeInBackground({ syncRegistry: false, syncProxy: true })
      await ProxyManager.setProxy()
    }
  } finally {
    recovering = false
  }
}

export const retryFailedProxies = async () => {
  const { proxyRecoveryEnabled, proxyFailures } =
    await browser.storage.local.get({
      proxyRecoveryEnabled: false, proxyFailures: {},
    })

  if (!proxyRecoveryEnabled || !await proxyAllowed() ||
    (await getProxyCheckState()).run.running) {
    return
  }
  const failed = await recoverableProxies(
    await ProxyManager.getSelectedProxies(), proxyFailures,
  )
  const ids = failed.slice(0, 4).map(({ id }) => id)

  if (ids.length > 0) {
    await startProxyChecks({ ids, automatic: true })
  }
}

const scheduleRecovery = () => withProxyLock(async () => {
  const { proxyRecoveryEnabled } = await browser.storage.local.get({
    proxyRecoveryEnabled: false,
  })
  const alarm = await browser.alarms.get(RECOVERY_ALARM)

  if (!proxyRecoveryEnabled || !await proxyAllowed()) {
    await browser.alarms.clear(RECOVERY_ALARM)
  } else if (alarm?.periodInMinutes !== 60) {
    await browser.alarms.create(RECOVERY_ALARM, { periodInMinutes: 60 })
  }
})

export const registerProxyRecovery = () => {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && recoveryKeys.some((key) => changes[key])) {
      scheduleRecovery().catch(() => console.warn('Could not schedule proxy recovery'))
    }
  })
  return scheduleRecovery()
}
