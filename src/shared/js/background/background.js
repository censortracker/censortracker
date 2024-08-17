/**
 * Background service for extension
 *
 * Handlers, connected with transitions or dependent on extension state,
 * are imported from 'stateManager/actions'.
 * Otherwise, we use handlers from 'base/.../handlers'.
 */
import browser from '../browser-api'
import { actions, configService, Extension } from '../extension'
import { handleMessage } from './messaging/messageHandler'

configService.start()

// Handle alarms for async tasks
browser.alarms.onAlarm.addListener(
  Extension.taskManager.handlers.handleOnAlarm,
)
// Handle extension lifecycle events
browser.runtime.onInstalled.addListener(actions.handleInstalled)
browser.runtime.onUpdateAvailable.addListener(
  Extension.handlers.handleOnUpdateAvailable,
)
// Handle tab changes (e.g. new tab, tab closed)
browser.tabs.onUpdated.addListener(actions.handleTabState)
browser.tabs.onCreated.addListener(actions.handleTabCreate)
// Handle storage changes (e.g. settings)
browser.storage.onChanged.addListener(
  ({ customProxiedDomains, ignoredHosts }) => {
    if (customProxiedDomains || ignoredHosts) {
      actions.handleObservedHostsChange()
    }
  },
)

if (browser.isFirefox) {
  // Firefox-specific handlers
  browser.proxy.onError.addListener(Extension.proxy.handlers.handleProxyError)
  browser.webRequest.onBeforeRequest.addListener(
    Extension.proxy.handlers.handleBeforeRequest,
    {
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
    Extension.proxy.handlers.handleProxyError,
    {
      urls: [
        '<all_urls>',
      ],
    },
  )
} else {
  // Chrome-specific handlers
  browser.webNavigation.onBeforeNavigate.addListener(
    Extension.proxy.handlers.handleBeforeRequest, {
      urls: [
        'http://*/*',
        'https://*/*',
      ],
      types: [
        'main_frame',
      ],
    },
  )
  browser.proxy.onProxyError.addListener(Extension.proxy.handlers.handleProxyError)
}

browser.runtime.onMessage.addListener(handleMessage)
