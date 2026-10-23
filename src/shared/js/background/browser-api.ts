import type { LocalStorage, ProxySettings, StorageChanges } from './storage'

declare global {
  // Chromium only; the DOM types do not include it yet.
  interface Navigator {
    userAgentData?: {
      getHighEntropyValues(hints: string[]): Promise<{
        fullVersionList: { brand: string; version: string }[]
      }>
    }
  }
}
interface ProxySettingDetails {
  value: ProxySettings
  levelOfControl: string
}
interface ExtensionBrowser extends Omit<typeof browser, 'storage' | 'proxy' | 'runtime'> {
  isFirefox: boolean
  runtime: Omit<typeof browser.runtime, 'sendMessage'> & {
    OnInstalledReason: { INSTALL: 'install'; UPDATE: 'update' }
    sendMessage(message: unknown): Promise<unknown>
  }
  tabs: typeof browser.tabs & { TabStatus: { LOADING: 'loading' } }
  storage: {
    local: LocalStorage
    onChanged: {
      addListener(listener: (changes: StorageChanges,
        area: string) => void): void
      removeListener(listener: (changes: StorageChanges,
        area: string) => void): void
    }
  }
  proxy: Omit<typeof browser.proxy, 'settings' | 'onRequest'> & {
    onProxyError: typeof chrome.proxy.onProxyError
    // Firefox accepts an asynchronous request listener.
    onRequest: browser.proxy._ProxyOnRequestEvent<
      (details: browser.proxy._OnRequestDetails) => Promise<unknown>>
    settings: {
      get(details: { incognito?: boolean }): Promise<ProxySettingDetails>
      set(details: { value: ProxySettings; scope?: string }): Promise<void>
      clear(details: { scope?: string }): Promise<void>
      onChange: {
        addListener(listener: (details: ProxySettingDetails) => void): void
        removeListener(listener: (details: ProxySettingDetails) => void): void
      }
    }
  }
}

/**
 * Returns the browser information.
 * @returns {{name: *, version: *}}
 */
export const getBrowserInfo = () => {
  const userAgent = navigator.userAgent
  const uaMatch = userAgent.match(/(Firefox|Chrome)\/([\d.]+)/) || []

  if (uaMatch[1] === 'Chrome') {
    const innerMatch = userAgent.match(/(Edg|OPR|YaBrowser)\/([\d.]+)/) || []

    if (innerMatch[2]) {
      uaMatch[2] = innerMatch[2]
    }

    if (innerMatch[1] === 'OPR') {
      uaMatch[1] = 'Opera'
    } else if (innerMatch[1] === 'Edg') {
      uaMatch[1] = 'Microsoft Edge'
    } else if (innerMatch[1] === 'YaBrowser') {
      uaMatch[1] = 'Yandex Browser'
    }
  }
  return { name: uaMatch[1], version: uaMatch[2] }
}

/**
 * Returns the browser's API object.
 * @returns {*}
 */
const getBrowser = (): ExtensionBrowser => {
  const isFirefox = typeof browser !== 'undefined' &&
    typeof browser.runtime?.getBrowserInfo === 'function'
  // Both browsers expose these APIs; proxy settings differ by platform.
  const api = (isFirefox ? browser : chrome) as unknown as ExtensionBrowser

  api.isFirefox = isFirefox
  return api
}

const browserAPI = getBrowser()

export const getDetailedBrowserInfo = async () => {
  const info = getBrowserInfo()

  try {
    if (browserAPI.isFirefox) {
      const { name, version } = await browserAPI.runtime.getBrowserInfo()

      return { name, version }
    }
    const { fullVersionList } = await navigator.userAgentData
      ?.getHighEntropyValues(['fullVersionList']) ?? { fullVersionList: [] }
    const expected = info.name === 'Chrome' ? 'Google Chrome' : info.name
    const version = fullVersionList.find(({ brand }) =>
      brand === expected)?.version

    return { ...info, version: version || info.version }
  } catch {
    return info
  }
}

export default browserAPI
