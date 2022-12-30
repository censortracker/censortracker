import {
  handleBeforeRequest,
  handleCustomProxiedDomainsChange,
  handleIgnoredHostsChange,
  handleInstalled,
  handleOnAlarm,
  handleOnConnect,
  handleOnUpdateAvailable,
  handleProxyError,
  handleStartup,
  handleStorageChanged,
  handleTabCreate,
  handleTabState,
} from 'Background/handlers'

browser.alarms.onAlarm.addListener(handleOnAlarm)
browser.proxy.onError.addListener(handleProxyError)
browser.runtime.onStartup.addListener(handleStartup)
browser.runtime.onConnect.addListener(handleOnConnect)
browser.runtime.onInstalled.addListener(handleInstalled)
browser.storage.onChanged.addListener(handleStorageChanged)
browser.storage.onChanged.addListener(handleIgnoredHostsChange)
browser.storage.onChanged.addListener(handleCustomProxiedDomainsChange)

browser.webRequest.onBeforeRequest.addListener(
  handleBeforeRequest, {
    urls: [
      'http://*/*',
      'https://*/*',
    ],
    types: ['main_frame'],
  },
)

browser.tabs.onUpdated.addListener(handleTabState)
browser.tabs.onCreated.addListener(handleTabCreate)
browser.webRequest.onErrorOccurred.addListener(handleProxyError, { urls: ['<all_urls>'] })
browser.runtime.onUpdateAvailable.addListener(handleOnUpdateAvailable)
