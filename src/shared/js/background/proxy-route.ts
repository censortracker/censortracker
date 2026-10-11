import browser from './browser-api'
import { consentAccepted, ConsentRequiredError, hasDataConsent } from './data-consent'
import { findHostMatch } from './host-match'
import { normalizeHostname } from './hostname'
import { isPrivateHost } from './private-host'
import type { ProxyRecord } from './proxy-record'
import type { ProbeRoute } from './routing'

let queue: Promise<unknown> = Promise.resolve()
let revision = 0
let serviceRoute: { hostname: string; route: string } | null = null
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

browser.storage.onChanged.addListener((changes, area) => {
  if ((!area || area === 'local') &&
    Object.keys(changes).some((key) => routeKeys.has(key))) {
    revision++
    permissionCache = null
  }
})

export const getRouteRevision = () => revision
export const getServiceRoute = () => serviceRoute
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

export const withProxyLock = <T>(operation: () => T | Promise<T>) => {
  const result = queue.then(async () => {
    await restoreServiceRoute()
    return operation()
  })

  queue = result.catch(() => {})
  return result
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

  await browser.proxy.settings.set(browser.isFirefox
    ? { value } : { value, scope: 'regular' })
  if (!await hasDataConsent()) {
    await browser.proxy.settings.clear({})
    throw new ConsentRequiredError()
  }
}

export const restoreServiceRoute = async () => {
  const { serviceRouteSnapshot } = await browser.storage.local.get(
    'serviceRouteSnapshot',
  )

  if (!serviceRouteSnapshot) {
    serviceRoute = null
    return
  }
  const { levelOfControl } = await browser.proxy.settings.get({})

  if (levelOfControl === 'controlled_by_this_extension' &&
    serviceRouteSnapshot.owned && await proxyAllowed()) {
    const { value } = serviceRouteSnapshot

    await browser.proxy.settings.set(browser.isFirefox
      ? { value } : { value, scope: 'regular' })
    if (!await hasDataConsent()) {
      await browser.proxy.settings.clear({})
    }
  } else {
    // Clear only CT's setting, not the other extension's setting.
    await browser.proxy.settings.clear({})
  }
  await browser.storage.local.remove('serviceRouteSnapshot')
  serviceRoute = null
}

// Caller holds the lock until the request and restoration have finished.
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
    snapshot.value.mode || snapshot.value.proxyType!,
  )) {
    return false
  }

  await browser.storage.local.set({ serviceRouteSnapshot: snapshot })
  serviceRoute = { hostname, route }
  await applyPac(`${base}
    var normalRoute = FindProxyForURL;
    FindProxyForURL = function(url, host) {
      if (host.toLowerCase().replace(/\\.$/, '') === ${JSON.stringify(hostname)}) {
        return ${JSON.stringify(route)};
      }
      return normalRoute(url, host);
    };`, true)
  return true
}
