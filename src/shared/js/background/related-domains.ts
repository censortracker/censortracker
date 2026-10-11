import browser from './browser-api'
import { findHostMatch } from './host-match'
import { normalizeHostname } from './hostname'
import { isPrivateHost } from './private-host'
import ProxyManager from './proxy'
import { proxyAllowed, withProxyLock } from './proxy-route'
import { normalizeRegistryDomains } from './registry-source-data'

// Runs in the tab's isolated world. No requests, page code, or history access.
export const collectPageResources = () => {
  const hosts = new Set<string>()

  for (const entry of performance.getEntriesByType('resource').slice(-2000)) {
    if (typeof entry.name !== 'string' || entry.name.length > 8192) {
      continue
    }
    try {
      const url = new URL(entry.name)

      if (['http:', 'https:'].includes(url.protocol)) {
        hosts.add(url.hostname)
      }
      if (hosts.size === 200) {
        break
      }
    } catch (error) {
      // Ignore invalid resource URLs.
    }
  }
  return { url: location.href, hosts: Array.from(hosts) }
}

export const findRelatedDomains = async ({
  tabId,
  url,
}: {
  tabId?: number;
  url?: string
} = {
}): Promise<string[]> => {
  if (!Number.isInteger(tabId) || tabId! < 0 || typeof url !== 'string' ||
    url.length > 8192 || !/^https?:\/\//.test(url)) {
    throw new TypeError('Invalid page')
  }
  const pageHost = new URL(url).hostname.toLowerCase().replace(/\.$/, '')
  let navigated = false
  const onUpdated = (id: number,
    changes: {
      status?: string;
      url?: string
    }) => {
    if (id === tabId && (changes.status === 'loading' || changes.url)) {
      navigated = true
    }
  }
  const inspect = async () => {
    if ((await browser.tabs.get(tabId!)).url !== url) {
      throw new Error('Page changed')
    }
    const results = browser.isFirefox
      ? await browser.tabs.executeScript(tabId!, {
        code: `(${collectPageResources.toString()})();`,
        frameId: 0,
        runAt: 'document_start',
      })
      : await browser.scripting.executeScript({
        target: { tabId: tabId!, frameIds: [0] },
        func: collectPageResources,
        injectImmediately: true,
      })
    const result = (browser.isFirefox ? results[0] : results[0]?.result) as
      ReturnType<typeof collectPageResources>

    if (navigated || result?.url !== url || !Array.isArray(result.hosts) ||
      result.hosts.length > 200 ||
      (await browser.tabs.get(tabId!)).url !== url) {
      throw new Error('Page changed or invalid resource list')
    }
    const hosts = result.hosts.map((host) => typeof host === 'string'
      ? host.toLowerCase().replace(/\.$/, '') : null)

    if (navigated) {
      throw new Error('Page changed')
    }
    return Array.from(new Set(hosts.filter((host): host is string =>
      typeof host === 'string' && host.length <= 253 &&
      host === normalizeHostname(host) && host !== pageHost &&
      !isPrivateHost(host)))).sort()
  }
  let timer: ReturnType<typeof setTimeout> | undefined

  browser.tabs.onUpdated.addListener(onUpdated)
  try {
    return await Promise.race([inspect(),
      new Promise<never>((resolve,
        reject) => {
        timer = setTimeout(
          () => reject(new Error('Page inspection timed out')), 5000,
        )
      })])
  } finally {
    clearTimeout(timer)
    browser.tabs.onUpdated.removeListener(onUpdated)
  }
}

export const addRelatedDomains = (hosts: unknown) => withProxyLock(async () => {
  if (!Array.isArray(hosts) || hosts.length === 0 || hosts.length > 200) {
    throw new TypeError('Invalid domain selection')
  }
  const selected = await normalizeRegistryDomains(hosts)
  const { customProxiedDomains, ignoredHosts } =
    await browser.storage.local.get({
      customProxiedDomains: [], ignoredHosts: [],
    })
  const ignored = new Set(ignoredHosts.map(normalizeHostname))
  const domains = new Set(customProxiedDomains)

  for (const host of selected) {
    if (!findHostMatch(host, ignored)) {
      domains.add(host)
    }
  }
  if (domains.size > 100000) {
    throw new Error('Custom domain list is full')
  }
  await browser.storage.local.set({ customProxiedDomains: Array.from(domains) })
  if (!await ProxyManager.setProxyInBackground({ ping: false }) &&
    await proxyAllowed()) {
    throw new Error('Proxy settings could not be applied')
  }
  return domains.size - customProxiedDomains.length
})
