import browser from './browser-api'
import { normalizeHostname } from './hostname'
import ProxyManager from './proxy'
import type { ProxyCheck } from './proxy-check-data'
import { countryCode, currentProxyCheck, publicIP } from './proxy-check-data'
import type { ProxyRecord } from './proxy-record'
import { getRouteRevision, proxyAllowed } from './proxy-route'
import Registry from './registry'

export interface ProxyRouteInfo {
  type: string
  proxy?: Pick<ProxyRecord, 'id' | 'name'> & Partial<Pick<ProxyRecord, 'protocol' | 'host' | 'port'>> | null
  fallbackCount?: number
  check?: Pick<ProxyCheck, 'status' | 'checkedAt' | 'exitIP' | 'exitCountry'> | null
  region?: string
  regionCode?: string
  domainCount?: number
}

// Public route descriptions must never include credentials or a PAC script.
export const describeProxyRoute = async ({ url }: { url?: string } = {
}): Promise<ProxyRouteInfo> => {
  const revision = getRouteRevision()
  const hostname = normalizeHostname(url)

  if (!hostname) {
    return { type: 'unavailable' }
  }
  if (!await proxyAllowed()) {
    return { type: 'disabled' }
  }
  const route = await ProxyManager.getRouteForHost(hostname)
  const proxy = route.proxies[0]
  const {
    proxyChecks, currentRegionName, currentRegionCode, registryRegionCode,
    activeProxyConfigName,
  } =
    await browser.storage.local.get({
      proxyChecks: {},
      currentRegionName: '',
      activeProxyConfigName: '',
      currentRegionCode: '',
      registryRegionCode: '',
    })
  const check = proxy ? await currentProxyCheck(proxy, proxyChecks) : null
  const domainCount = await Registry.getDomainCount()

  if (revision !== getRouteRevision()) {
    return describeProxyRoute({ url })
  }
  return {
    type: route.type,
    proxy: proxy ? {
      id: proxy.id,
      name: proxy.name || activeProxyConfigName || 'Censor Tracker Proxy Server',
      ...(proxy.id === 'builtin' ? {} : {
        protocol: proxy.protocol,
        host: proxy.host,
        port: proxy.port,
      }),
    } : null,
    fallbackCount: Math.max(0, route.proxies.length - 1),
    check: check && proxy && Number.isFinite(check.checkedAt) ? {
      status: check.status,
      checkedAt: check.checkedAt,
      exitIP: check.status === 'ok' && proxy.id !== 'builtin' ? publicIP(check.exitIP) : '',
      exitCountry: check.status === 'ok' ? countryCode(check.exitCountry) : '',
    } : null,
    region: currentRegionName,
    regionCode: countryCode(currentRegionCode || registryRegionCode),
    domainCount,
  }
}
