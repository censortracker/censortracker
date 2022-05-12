import {
  handleBeforeRequestPing,
  handleCustomProxiedDomainsChange,
  handleIgnoredHostsChange,
  handleInformationDisseminationOrganizer,
  handleInstalled,
  handleProxyError,
  handleStartup,
  handleStorageChanged,
} from '@/shared/scripts/handlers'
import Ignore from '@/shared/scripts/ignore'
import ProxyManager from '@/shared/scripts/proxy'
import Registry from '@/shared/scripts/registry'
import Settings from '@/shared/scripts/settings'
import * as utilities from '@/shared/scripts/utilities'

browser.proxy.onError.addListener(handleProxyError)
browser.runtime.onStartup.addListener(handleStartup)
browser.runtime.onInstalled.addListener(handleInstalled)
browser.storage.onChanged.addListener(handleStorageChanged)
browser.storage.onChanged.addListener(handleIgnoredHostsChange)
browser.storage.onChanged.addListener(handleCustomProxiedDomainsChange)

const handleBeforeRequestCheckIncognitoAccess = async (_details) => {
  const allowed = await browser.extension.isAllowedIncognitoAccess()

  if (!allowed) {
    await ProxyManager.requestIncognitoAccess()
  }
}

browser.webRequest.onBeforeRequest.addListener(
  handleBeforeRequestCheckIncognitoAccess,
  utilities.getRequestFilter(),
)

browser.webRequest.onBeforeRequest.addListener(
  handleBeforeRequestPing,
  utilities.getRequestFilter(),
)

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
    if (extensionEnabled && !isIgnored && utilities.isValidURL(tabUrl)) {
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

/**
 * Check if proxy is ready to use.
 * Set proxy if proxying enabled and incognito access granted.
 * @returns {Promise<boolean>}
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
    console.warn('Proxy is not ready to use. Check if private browsing permissions granted.')
  }
}
