import browser from './browser-api'
import { consentAccepted, ConsentRequiredError, hasDataConsent } from './data-consent'
import { findHostMatch } from './host-match'
import { normalizeHostname } from './hostname'
import { isPrivateHost } from './private-host'
import type { ProxyRecord } from './proxy-record'
import type { ProbeRoute } from './routing'
import type { ProxySettings } from './storage'

interface ServiceRoute {
  hostname: string
  route: string
  holders: number
  released: Promise<void>
  release: () => void
}

let queue: Promise<unknown> = Promise.resolve()
let revision = 0
// Temporary routes for service hosts; each one is held until its requests end.
const serviceRoutes = new Map<string, ServiceRoute>()
let drained: Promise<void> = Promise.resolve()
let signalDrained: () => void = () => {}
let exclusiveWaiting = 0
let exclusiveIdle: Promise<void> = Promise.resolve()
let signalExclusiveIdle: () => void = () => {}
let pacRevision = 0
let appliedValue: string | null = null
const probes = new Map<string, ProbeRoute>()
let permissionCache: Promise<boolean> | null
let watchingControl = false
const routeKeys = new Set([
  'dataConsent', 'enableExtension', 'useProxy', 'domains', 'useRegistry', 'ignoredHosts',
  'customProxiedDomains', 'proxyServerURI', 'customProxyProtocol',
  'customProxyServerURI', 'localProxyURI', 'useLocalProxy', 'localProxyAlive',
  'proxies', 'selectedProxyIds', 'proxyAll', 'proxyFailures',
  'siteCountryRules', 'proxyChecks',
  'registrySource', 'externalRegistry', 'antizapret',
])

export const watchRoutes = () => {
  browser.storage.onChanged.addListener((changes, area) => {
    if ((!area || area === 'local') &&
      Object.keys(changes).some((key) => routeKeys.has(key))) {
      revision++
      permissionCache = null
    }
  })
}

export const getRouteRevision = () => revision
export const getServiceRoute = (hostname?: string) => {
  const route = hostname === undefined
    ? serviceRoutes.values().next().value : serviceRoutes.get(hostname)

  return route ? { hostname: route.hostname, route: route.route } : null
}
// Counts proxy setting writes made by this extension.
export const getPacRevision = () => pacRevision
export const isAppliedProxyValue = (value: unknown) =>
  appliedValue !== null && JSON.stringify(value) === appliedValue
export const getProbeRoutes = () => Array.from(probes.values())
export const noteProbeAuthFailure = (id: string) => {
  for (const probe of probes.values()) {
    if (probe.proxy.id === id) {
      probe.authFailed = true
    }
  }
}
export const setProbeRoute = (hostname: string, proxy: ProxyRecord | null) => {
  if (proxy) {
    probes.set(hostname, { hostname, proxy, expiresAt: Date.now() + 30000 })
  } else {
    probes.delete(hostname)
  }
  revision++
}

export const mustUseDirect = async (hostname: string) => {
  const { ignoredHosts } = await browser.storage.local.get({ ignoredHosts: [] })

  return isPrivateHost(hostname) || Boolean(findHostMatch(hostname,
    new Set(ignoredHosts.map(normalizeHostname))))
}

const enqueue = <T>(operation: () => T | Promise<T>) => {
  const result = queue.then(operation)

  queue = result.catch(() => {})
  return result
}

type Outcome<T> = { value: T } | { wait: Promise<void> }

const tryExclusive = <T>(operation: () => T | Promise<T>) =>
  enqueue(async (): Promise<Outcome<T>> => {
    if (serviceRoutes.size > 0) {
      return { wait: drained }
    }
    await restoreServiceRoute()
    return { value: await operation() }
  })

// Runs an exclusive proxy operation once no service route is active. New
// service routes wait for it, so a steady stream of requests cannot starve it.
export const withProxyLock = async <T>(operation: () => T | Promise<T>) => {
  if (exclusiveWaiting++ === 0) {
    exclusiveIdle = new Promise((resolve) => {
      signalExclusiveIdle = resolve
    })
  }
  try {
    for (;;) {
      const outcome = await tryExclusive(operation)

      if ('value' in outcome) {
        return outcome.value
      }
      await outcome.wait
    }
  } finally {
    if (--exclusiveWaiting === 0) {
      signalExclusiveIdle()
    }
  }
}

const tryAcquire = (hostname: string, route: string) =>
  enqueue(async (): Promise<Outcome<boolean>> => {
    const current = serviceRoutes.get(hostname)

    if (current && current.route !== route) {
      return { wait: current.released }
    }
    if (!await proxyAllowed()) {
      const { levelOfControl } = await browser.proxy.settings.get({})

      if (levelOfControl === 'controlled_by_this_extension') {
        await clearProxyValue()
      }
      return { value: false }
    }
    return { value: await setServiceRoute(hostname, route) }
  })

// Adds a temporary route for a service request without blocking other
// requests. Returns false when proxy use is unavailable or the inherited
// proxy configuration cannot be overridden; a leftover CT setting is cleared.
export const acquireServiceRoute = async (hostname: string, route: string) => {
  for (;;) {
    if (exclusiveWaiting > 0) {
      await exclusiveIdle
      continue
    }
    const outcome = await tryAcquire(hostname, route)

    if ('value' in outcome) {
      return outcome.value
    }
    await outcome.wait
  }
}

export const releaseServiceRoute = (hostname: string) =>
  enqueue(() => clearServiceRoute(hostname))

const writeProxyValue = async (value: ProxySettings) => {
  pacRevision++
  appliedValue = JSON.stringify(value)
  await browser.proxy.settings.set(browser.isFirefox
    ? { value } : { value, scope: 'regular' })
}

const clearProxyValue = async () => {
  pacRevision++
  appliedValue = null
  await browser.proxy.settings.clear({})
}

const servicePac = (base: string) => {
  const routes = Object.fromEntries(Array.from(serviceRoutes.values(),
    ({ hostname, route }) => [hostname, route]))

  return `${base}
    var normalRoute = FindProxyForURL;
    var serviceRoutes = ${JSON.stringify(routes)};
    FindProxyForURL = function(url, host) {
      var name = host.toLowerCase().replace(/\\.$/, '');
      if (Object.prototype.hasOwnProperty.call(serviceRoutes, name)) {
        return serviceRoutes[name];
      }
      return normalRoute(url, host);
    };`
}

const forgetServiceRoutes = () => {
  for (const route of serviceRoutes.values()) {
    route.release()
  }
  serviceRoutes.clear()
  signalDrained()
}

export const proxyAllowed = async () => {
  const {
    dataConsent, enableExtension, useProxy, useLocalProxy, localProxyAlive,
  } =
    await browser.storage.local.get({
      dataConsent: null,
      enableExtension: false,
      useProxy: true,
      useLocalProxy: false,
      localProxyAlive: false,
    })
  const { levelOfControl } = await browser.proxy.settings.get({})

  return consentAccepted(dataConsent) && enableExtension && useProxy &&
    (!useLocalProxy || localProxyAlive) &&
    ['controllable_by_this_extension', 'controlled_by_this_extension']
      .includes(levelOfControl)
}

// Request listeners must not copy the full PAC from browser settings each time.
export const proxyRequestAllowed = async (): Promise<boolean> => {
  const changed = browser.proxy.settings.onChange

  if (!changed) {
    return proxyAllowed()
  }
  if (!watchingControl) {
    changed.addListener(() => {
      permissionCache = null
    })
    watchingControl = true
  }
  const pending = permissionCache || proxyAllowed()

  permissionCache = pending
  let allowed

  try {
    allowed = await pending
  } catch (error) {
    if (permissionCache === pending) {
      permissionCache = null
    }
    throw error
  }

  return permissionCache === pending ? allowed : proxyRequestAllowed()
}

export const applyPac = async (data: string, mandatory = false) => {
  if (!await hasDataConsent()) {
    throw new ConsentRequiredError()
  }
  const value = browser.isFirefox
    ? {
      proxyType: 'autoConfig',
      autoConfigUrl: `data:application/x-ns-proxy-autoconfig,${encodeURIComponent(data)}`,
    }
    : { mode: 'pac_script', pacScript: { data, mandatory } }

  await writeProxyValue(value)
  if (!await hasDataConsent()) {
    await clearProxyValue()
    throw new ConsentRequiredError()
  }
}

// Drops every temporary route and restores the saved proxy configuration.
// Caller holds the lock.
export const restoreServiceRoute = async () => {
  forgetServiceRoutes()
  const { serviceRouteSnapshot } = await browser.storage.local.get(
    'serviceRouteSnapshot',
  )

  if (!serviceRouteSnapshot) {
    return
  }
  const { levelOfControl } = await browser.proxy.settings.get({})

  if (levelOfControl === 'controlled_by_this_extension' &&
    serviceRouteSnapshot.owned && await proxyAllowed()) {
    await writeProxyValue(serviceRouteSnapshot.value)
    if (!await hasDataConsent()) {
      await clearProxyValue()
    }
  } else {
    // Clear only CT's setting, not the other extension's setting.
    await clearProxyValue()
  }
  await browser.storage.local.remove('serviceRouteSnapshot')
}

// Releases one holder of a temporary route; the last route restores the
// saved configuration. Caller holds the lock.
export const clearServiceRoute = async (hostname: string) => {
  const current = serviceRoutes.get(hostname)

  if (!current || --current.holders > 0) {
    return
  }
  serviceRoutes.delete(hostname)
  current.release()
  if (serviceRoutes.size === 0) {
    await restoreServiceRoute()
  }
}

// Adds a temporary route, or another holder of the same route. Caller holds
// the lock until the route is cleared.
export const setServiceRoute = async (hostname: string, route: string) => {
  if (route !== 'DIRECT' && await mustUseDirect(hostname)) {
    throw new Error('Proxy request blocked by an exclusion or a private host')
  }
  if (!await proxyAllowed()) {
    throw new Error('Service routing unavailable: proxy disabled or not controlled')
  }
  const original = await browser.proxy.settings.get({})
  const { serviceRouteSnapshot } = await browser.storage.local.get(
    'serviceRouteSnapshot',
  )
  const snapshot = serviceRouteSnapshot || {
    value: original.value,
    owned: original.levelOfControl === 'controlled_by_this_extension',
  }
  let base = 'function FindProxyForURL(url, host) { return "DIRECT"; }'

  if (snapshot.owned) {
    if (browser.isFirefox) {
      const url = snapshot.value.autoConfigUrl

      if (!url || !/^(blob:|data:)/.test(url)) {
        throw new Error('Cannot safely override the current Firefox proxy')
      }
      base = await (await fetch(url)).text()
      snapshot.value = {
        proxyType: 'autoConfig',
        autoConfigUrl: `data:application/x-ns-proxy-autoconfig,${encodeURIComponent(base)}`,
      }
    } else if (snapshot.value.pacScript?.data) {
      base = snapshot.value.pacScript.data
    } else {
      throw new Error('Cannot safely override the current proxy configuration')
    }
  } else if (!['direct', 'none'].includes(
    snapshot.value.mode || snapshot.value.proxyType || '',
  )) {
    return false
  }

  await browser.storage.local.set({ serviceRouteSnapshot: snapshot })
  const current = serviceRoutes.get(hostname)

  if (current && current.route === route) {
    current.holders++
    return true
  }
  if (serviceRoutes.size === 0) {
    drained = new Promise((resolve) => {
      signalDrained = resolve
    })
  }
  let release = () => {}
  const released = new Promise<void>((resolve) => {
    release = resolve
  })

  current?.release()
  serviceRoutes.set(hostname, {
    hostname, route, holders: 1, released, release,
  })
  await applyPac(servicePac(base), true)
  return true
}
