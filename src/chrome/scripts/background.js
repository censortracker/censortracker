import {
  handleBeforeRequest,
  handleCustomProxiedDomainsChange,
  handleIgnoredHostsChange,
  handleInstalled,
  handleOnAlarm,
  handleOnConnect,
  handleProxyError,
  handleStartup,
  handleStorageChanged,
  handleTabCreate,
  handleTabState,
} from '@/shared/js/background/handlers'
import { getRequestFilter } from '@/shared/js/background/utilities'

chrome.alarms.onAlarm.addListener(handleOnAlarm)
chrome.runtime.onStartup.addListener(handleStartup)
chrome.runtime.onConnect.addListener(handleOnConnect)
chrome.runtime.onInstalled.addListener(handleInstalled)
chrome.proxy.onProxyError.addListener(handleProxyError)
chrome.storage.onChanged.addListener(handleStorageChanged)
chrome.storage.onChanged.addListener(handleIgnoredHostsChange)
chrome.storage.onChanged.addListener(handleCustomProxiedDomainsChange)
chrome.webNavigation.onBeforeNavigate.addListener(
  handleBeforeRequest,
  getRequestFilter(),
)

chrome.tabs.onUpdated.addListener(handleTabState)
chrome.tabs.onCreated.addListener(handleTabCreate)
