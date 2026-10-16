import browser from './browser-api'
import ProxyManager from './proxy'
import { MAX_IMPORT_BYTES, parseProxyImport } from './proxy-import'
import { updateProxyList } from './proxy-list'
import { proxyKey } from './proxy-record'
import { proxyAllowed, withProxyLock } from './proxy-route'
import { parseRegistryList } from './registry-source-data'
import { requestText } from './request'

let downloading = false

export const importAntizapret = async () => {
  if (downloading) {
    throw new Error('Antizapret download already running')
  }
  downloading = true
  const controller = new AbortController()

  try {
    const options = {
      timeout: 30000, maxBytes: MAX_IMPORT_BYTES, redirect: 'error' as const, signal: controller.signal,
    }
    const [pac, list] = await Promise.all([
      requestText('https://p.thenewone.lol:8443/proxy.pac', options),
      requestText('https://antizapret.prostovpn.org/domains-export.txt', options),
    ])
    const parsed = parseProxyImport(pac, { pac: true })
    const domains = await parseRegistryList(list)

    if (parsed.proxies.length === 0 || parsed.truncated) {
      throw new Error('Invalid Antizapret response')
    }
    return await withProxyLock(async () => {
      const state = await updateProxyList({
        operation: 'append',
        proxies: parsed.proxies.map((proxy) => ({
          ...proxy, provider: 'antizapret', name: `Antizapret ${proxy.protocol} ${proxy.host}`,
        })),
      })

      await browser.storage.local.set({
        antizapret: {
          domains, proxyKeys: parsed.proxies.map(proxyKey),
        },
      })
      if (!await ProxyManager.setProxyInBackground({ ping: false }) &&
        await proxyAllowed()) {
        throw new Error('Proxy settings could not be applied')
      }
      return {
        added: state.added, skipped: (state.skipped ?? 0) + parsed.skipped,
      }
    })
  } finally {
    controller.abort()
    downloading = false
  }
}
