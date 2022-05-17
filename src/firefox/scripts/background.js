import {
  handleBeforeRequest,
  handleCustomProxiedDomainsChange,
  handleIgnoredHostsChange,
  handleInformationDisseminationOrganizer,
  handleInstalled,
  handleOnAlarm,
  handleOnConnect,
  handleProxyError,
  handleStartup,
  handleStorageChanged,
} from '@/shared/scripts/handlers'
import Ignore from '@/shared/scripts/ignore'
import ProxyManager from '@/shared/scripts/proxy'
import Registry from '@/shared/scripts/registry'
import Settings from '@/shared/scripts/settings'
import { getRequestFilter, isValidURL } from '@/shared/scripts/utilities'

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

/**
 * Check if proxy is ready to use.
 * Set proxy if proxying enabled and incognito access granted.
 */
const checkProxyReadiness = async () => {
  const proxyingEnabled = await ProxyManager.enabled()
  const controlledByThisExtension = await ProxyManager.controlledByThisExtension()
  const allowedIncognitoAccess = await browser.extension.isAllowedIncognitoAccess()

  if (proxyingEnabled && allowedIncognitoAccess) {
    if (!controlledByThisExtension) {
      await ProxyManager.setProxy()
      await ProxyManager.grantIncognitoAccess()
    }
  } else {
    await ProxyManager.requestIncognitoAccess()
  }
}

const handleTabCreate = async ({ id }) => {
  const extensionEnabled = await Settings.extensionEnabled()

  if (extensionEnabled) {
    await checkProxyReadiness()
  } else {
    Settings.setDisableIcon(id)
  }
}

browser.tabs.onCreated.addListener(handleTabCreate)

const handleTabState = async (tabId, changeInfo, { url: tabUrl }) => {
  const isIgnored = await Ignore.contains(tabUrl)
  const proxyingEnabled = await ProxyManager.enabled()
  const extensionEnabled = await Settings.extensionEnabled()

  if (changeInfo && changeInfo.status === browser.tabs.TabStatus.COMPLETE) {
    if (extensionEnabled && !isIgnored && isValidURL(tabUrl)) {
      await checkProxyReadiness()

      const urlBlocked = await Registry.contains(tabUrl)
      const { url: disseminatorUrl, cooperationRefused } =
        await Registry.retrieveInformationDisseminationOrganizerJSON(tabUrl)

      if (proxyingEnabled && urlBlocked) {
        Settings.setBlockedIcon(tabId)
        return
      }

      if (disseminatorUrl) {
        Settings.setDangerIcon(tabId)
        if (!cooperationRefused) {
          await handleInformationDisseminationOrganizer(tabUrl)
        }
      }
    }
  }
}

browser.tabs.onActivated.addListener(handleTabState)
browser.tabs.onUpdated.addListener(handleTabState)
