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

chrome.alarms.onAlarm.addListener(handleOnAlarm)
chrome.runtime.onStartup.addListener(handleStartup)
chrome.runtime.onInstalled.addListener(handleInstalled)
chrome.proxy.onProxyError.addListener(handleProxyError)
chrome.storage.onChanged.addListener(handleStorageChanged)
chrome.storage.onChanged.addListener(handleIgnoredHostsChange)
chrome.storage.onChanged.addListener(handleCustomProxiedDomainsChange)
chrome.webNavigation.onBeforeNavigate.addListener(
  handleBeforeRequest, {
    urls: [
      'http://*/*',
      'https://*/*',
    ],
    types: ['main_frame'],
  },
)

chrome.tabs.onUpdated.addListener(handleTabState)
chrome.tabs.onCreated.addListener(handleTabCreate)
chrome.runtime.onUpdateAvailable.addListener(handleOnUpdateAvailable)
