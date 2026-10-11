import browser from './browser-api'
import { normalizeHostname } from './hostname'
import ProxyManager from './proxy'
import { proxyDirective } from './proxy-address'
import type { ProxyRecord } from './proxy-record'
import { hasProxyAuth, proxyKey } from './proxy-record'
import { getServiceRoute, noteProbeAuthFailure, proxyRequestAllowed } from './proxy-route'

interface FirefoxProxyInfo {
  type: 'http' | 'https' | 'socks4' | 'socks'
  host: string
  port?: number
  failoverTimeout: number
  proxyDNS?: boolean
  username?: string
  password?: string
}

const requestRoute = async (url: string) => {
  let hostname

  try {
    hostname = new URL(url).hostname.toLowerCase().replace(/\.$/, '')
  } catch (error) {
    return { type: 'inactive', proxies: [] }
  }

  if (!hostname || !await proxyRequestAllowed()) {
    return { type: 'inactive', proxies: [] }
  }
  const override = getServiceRoute()

  if (override?.hostname === hostname) {
    return {
      type: override.route === 'DIRECT' ? 'direct' : 'proxy',
      proxies: (await ProxyManager.getSelectedProxies()).filter((proxy) =>
        proxyDirective(proxy.protocol, `${proxy.host}:${proxy.port}`) === override.route),
    }
  }
  return ProxyManager.getRouteForHost(hostname)
}
const requestProxies = async (url: string) => {
  const route = await requestRoute(url)

  return await proxyRequestAllowed() ? route.proxies : []
}

export const createAuthHandler = (
  getProxies = requestProxies, onFailure: (id: string) => void = () => {},
) => {
  const attempts = new Map<string, Set<string>>()
  const handle = async (
    details: browser.webRequest._OnAuthRequiredDetails,
  ): Promise<browser.webRequest.BlockingResponse> => {
    if (!details.isProxy || !details.challenger) {
      return {}
    }
    const host = normalizeHostname(details.challenger.host) ||
      normalizeHostname(`[${details.challenger.host}]`)
    const candidates = await getProxies(details.url)
    const proxy = candidates.find((entry) =>
      ['HTTP', 'HTTPS'].includes(entry.protocol) && entry.host === host &&
      entry.port === details.challenger.port)

    if (!proxy) {
      return {}
    }
    if (!hasProxyAuth(proxy)) {
      if (proxy.checking) {
        onFailure(proxy.id)
        return { cancel: true }
      }
      return {}
    }
    const tried = attempts.get(details.requestId) || new Set()
    const key = proxyKey(proxy)

    if (tried.has(key) || tried.size >= 10 ||
      (!attempts.has(details.requestId) && attempts.size >= 1024)) {
      onFailure(proxy.id)
      return { cancel: true }
    }
    tried.add(key)
    attempts.set(details.requestId, tried)
    return {
      authCredentials: { username: proxy.username!, password: proxy.password! },
    }
  }

  return {
    handle,
    clear: ({ requestId }: { requestId: string }) => attempts.delete(requestId),
  }
}

export const firefoxProxyInfo = (proxy: ProxyRecord): FirefoxProxyInfo => {
  const type = ({ HTTP: 'http', HTTPS: 'https', SOCKS4: 'socks4', SOCKS5: 'socks' } as Record<string, FirefoxProxyInfo['type']>)[proxy.protocol]

  return {
    type,
    host: proxy.host!.replace(/^\[|\]$/g, ''),
    port: proxy.port,
    failoverTimeout: 8,
    ...(proxy.protocol === 'SOCKS5' ? { proxyDNS: true } : {}),
    ...(proxy.protocol === 'SOCKS5' && hasProxyAuth(proxy)
      ? { username: proxy.username!, password: proxy.password! } : {}),
  }
}

export const handleFirefoxProxy = async ({ url }: { url: string }) => {
  const { type, proxies } = await requestRoute(url)

  if (type === 'inactive' || !await proxyRequestAllowed()) {
    return undefined
  }
  if (type === 'direct') {
    return null
  }
  // Keep the blocking PAC as the fallback after the last proxy.
  return proxies.map(firefoxProxyInfo)
}

export const registerProxyAuth = () => {
  const { handle, clear } = createAuthHandler(
    requestProxies, noteProbeAuthFailure,
  )
  const filter = { urls: ['<all_urls>'] }

  browser.webRequest.onAuthRequired.addListener(browser.isFirefox
    ? (details) => handle(details).catch(() => ({ cancel: true }))
    : (details, respond) => {
      handle(details).then(respond!, () => respond!({ cancel: true }))
    }, filter, [browser.isFirefox ? 'blocking' : 'asyncBlocking'])
  browser.webRequest.onCompleted.addListener(clear, filter)
  browser.webRequest.onErrorOccurred.addListener(clear, filter)
  if (browser.isFirefox) {
    browser.proxy.onRequest.addListener(
      (details) => handleFirefoxProxy(details).catch(() => undefined), filter,
    )
  }
}
