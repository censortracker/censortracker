import { parseAnticensority } from './anticensority'
import browser from './browser-api'
import { isConsentError } from './data-consent'
import { setRegistryState } from './index-cache'
import ProxyManager from './proxy'
import { proxyAllowed, withProxyLock } from './proxy-route'
import { requestRegistry } from './registry-request'
import {
  MAX_REGISTRY_BYTES, parseRegistryList, registrySourceDefaults,
  registrySourceKey, validateRegistrySource,
} from './registry-source-data'
import { requestText } from './request'

let download: AbortController | null
const readState = () => browser.storage.local.get({
  registrySource: registrySourceDefaults,
  enableExtension: false,
  useProxy: true,
})

export const getRegistrySourceState = async () => {
  const { registrySource, externalRegistry } = await browser.storage.local.get({
    registrySource: registrySourceDefaults, externalRegistry: null,
  })
  const cache = externalRegistry?.source === registrySourceKey(registrySource)
    ? externalRegistry : null

  return {
    source: registrySource,
    count: cache?.domains.length || 0,
    updatedAt: cache?.updatedAt || 0,
  }
}

export const updateRegistrySource = (source: unknown) =>
  withProxyLock(async () => {
    await setRegistryState({
      registrySource: validateRegistrySource(source),
    })
    if (!await ProxyManager.setProxyInBackground({ ping: false }) &&
    await proxyAllowed()) {
      throw new Error('Proxy settings could not be applied')
    }
    return getRegistrySourceState()
  })

export const refreshRegistrySource = async ({ automatic = false } = {}) => {
  if (download) {
    throw new Error('A registry source download is already running')
  }
  const controller = new AbortController()

  download = controller
  try {
    const state = await readState()
    const source = validateRegistrySource(state.registrySource)

    if (automatic && (!source.enabled || !source.autoUpdate ||
      !state.enableExtension || !state.useProxy)) {
      return undefined
    }
    if (!source.url) {
      throw new Error('No registry source URL')
    }
    const { externalRegistry } = await browser.storage.local.get('externalRegistry')
    const cache = externalRegistry?.source === registrySourceKey(source)
      ? externalRegistry.cache : null
    const result = await requestRegistry(source.url, cache,
      (method) => requestText(source.url, {
        method,
        metadata: true,
        timeout: 30000,
        maxBytes: MAX_REGISTRY_BYTES,
        redirect: 'error',
        signal: controller.signal,
      }), controller.signal)

    if (controller.signal.aborted) {
      throw new Error('Request cancelled')
    }
    if (result.unchanged) {
      return getRegistrySourceState()
    }
    const parse = source.kind === 'anticensority'
      ? parseAnticensority : parseRegistryList
    const domains = await parse(result.data, controller.signal)

    return await withProxyLock(async () => {
      const current = await readState()
      const sameSource = registrySourceKey(current.registrySource) ===
        registrySourceKey(source)

      if (controller.signal.aborted || !sameSource ||
        (automatic && (!current.enableExtension || !current.useProxy ||
          !current.registrySource.enabled ||
          !current.registrySource.autoUpdate))) {
        return undefined
      }
      await setRegistryState({
        externalRegistry: {
          source: registrySourceKey(source),
          domains,
          updatedAt: Date.now(),
          cache: result.cache,
        },
      })
      if (!await ProxyManager.setProxyInBackground({ ping: false }) &&
        await proxyAllowed()) {
        throw new Error('Proxy settings could not be applied')
      }
      return getRegistrySourceState()
    })
  } catch (error) {
    if (isConsentError(error)) {
      throw error
    }
    // Do not put source URL tokens or downloaded text in logs or diagnostics.
    // Do not retain the cause: it can contain a private source URL.
    // eslint-disable-next-line preserve-caught-error
    throw new Error('External registry update failed')
  } finally {
    download = null
  }
}

export const registerRegistrySource = () => {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.dataConsent || changes.registrySource ||
      changes.enableExtension?.newValue === false ||
      changes.useProxy?.newValue === false)) {
      if (download) {
        download.abort()
      }
    }
  })
}
