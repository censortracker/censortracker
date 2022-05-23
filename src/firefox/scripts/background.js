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

browser.alarms.onAlarm.addListener(handleOnAlarm)
browser.proxy.onError.addListener(handleProxyError)
browser.runtime.onStartup.addListener(handleStartup)
browser.runtime.onConnect.addListener(handleOnConnect)
browser.runtime.onInstalled.addListener(handleInstalled)
browser.storage.onChanged.addListener(handleStorageChanged)
browser.storage.onChanged.addListener(handleIgnoredHostsChange)
browser.storage.onChanged.addListener(handleCustomProxiedDomainsChange)

browser.webRequest.onBeforeRequest.addListener(
  handleBeforeRequest,
  getRequestFilter(),
)

browser.tabs.onUpdated.addListener(handleTabState)
browser.tabs.onCreated.addListener(handleTabCreate)
