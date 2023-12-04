import {
  handleBeforeRequest,
  handleCustomProxiedDomainsChange,
  handleIgnoredHostsChange,
  handleInstalled,
  handleOnAlarm,
  handleOnUpdateAvailable,
  handleProxyError,
  handleStartup,
  handleStorageChanged,
  handleTabCreate,
  handleTabState,
} from 'Background/handlers'

import browser from './browser-api'

browser.alarms.onAlarm.addListener(handleOnAlarm)
browser.runtime.onStartup.addListener(handleStartup)
browser.runtime.onInstalled.addListener(handleInstalled)
browser.runtime.onUpdateAvailable.addListener(handleOnUpdateAvailable)
browser.tabs.onUpdated.addListener(handleTabState)
browser.tabs.onCreated.addListener(handleTabCreate)
browser.storage.onChanged.addListener(handleStorageChanged)
browser.storage.onChanged.addListener(handleIgnoredHostsChange)
browser.storage.onChanged.addListener(handleCustomProxiedDomainsChange)

if (browser.isFirefox) {
  browser.proxy.onError.addListener(handleProxyError)
  browser.webRequest.onBeforeRequest.addListener(
    handleBeforeRequest, {
      urls: ['http://*/*', 'https://*/*'],
      types: ['main_frame'],
    },
  )

  browser.webRequest.onErrorOccurred.addListener(handleProxyError, { urls: ['<all_urls>'] })
} else {
  chrome.webNavigation.onBeforeNavigate.addListener(
    handleBeforeRequest, {
      urls: ['http://*/*', 'https://*/*'],
      types: ['main_frame'],
    },
  )
  chrome.proxy.onProxyError.addListener(handleProxyError)
}
