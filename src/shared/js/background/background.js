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

// Handle alarms for async tasks
browser.alarms.onAlarm.addListener(handleOnAlarm)
// Handle extension lifecycle events
browser.runtime.onStartup.addListener(handleStartup)
browser.runtime.onInstalled.addListener(handleInstalled)
browser.runtime.onUpdateAvailable.addListener(handleOnUpdateAvailable)
// Handle tab changes (e.g. new tab, tab closed)
browser.tabs.onUpdated.addListener(handleTabState)
browser.tabs.onCreated.addListener(handleTabCreate)
// Handle storage changes (e.g. settings)
browser.storage.onChanged.addListener(handleStorageChanged)
browser.storage.onChanged.addListener(handleIgnoredHostsChange)
browser.storage.onChanged.addListener(handleCustomProxiedDomainsChange)

if (browser.isFirefox) {
  // Firefox-specific handlers
  browser.proxy.onError.addListener(handleProxyError)
  browser.webRequest.onBeforeRequest.addListener(
    handleBeforeRequest, {
      urls: [
        'http://*/*',
        'https://*/*',
      ],
      types: [
        'main_frame',
      ],
    },
  )
  browser.webRequest.onErrorOccurred.addListener(
    handleProxyError, {
      urls: [
        '<all_urls>',
      ],
    },
  )
} else {
  // Chromium-specific handlers (Chrome, Opera, Edge, Yandex, …). Each
  // registration is guarded: these run while the service worker is still being
  // evaluated, so an API a given Chromium build doesn't expose used to throw
  // here and silently drop EVERY listener registered above — leaving the
  // extension looking completely dead instead of merely missing one feature.
  if (browser.webNavigation) {
    browser.webNavigation.onBeforeNavigate.addListener(
      handleBeforeRequest, {
        urls: [
          'http://*/*',
          'https://*/*',
        ],
        types: [
          'main_frame',
        ],
      },
    )
  }

  if (browser.proxy && browser.proxy.onProxyError) {
    browser.proxy.onProxyError.addListener(handleProxyError)
  }
}
