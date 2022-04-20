import {
  handleBeforeRequestPing,
  handleCustomProxiedDomainsChange,
  handleIgnoredHostsChange,
  handleProxyError,
  handleStartup,
} from '@/common/scripts/handlers'
import ignore from '@/common/scripts/ignore'
import proxy from '@/common/scripts/proxy'
import registry from '@/common/scripts/registry'
import settings from '@/common/scripts/settings'
import * as storage from '@/common/scripts/storage'
import * as utilities from '@/common/scripts/utilities'

browser.runtime.onStartup.addListener(handleStartup)
browser.proxy.onError.addListener(handleProxyError)
browser.storage.onChanged.addListener(handleIgnoredHostsChange)
browser.storage.onChanged.addListener(handleCustomProxiedDomainsChange)

const handleBeforeRequestCheckIncognitoAccess = async (_details) => {
  const allowed = await browser.extension.isAllowedIncognitoAccess()

  if (!allowed) {
    await proxy.requestIncognitoAccess()
  }
}

browser.webRequest.onBeforeRequest.addListener(
  handleBeforeRequestPing,
  { urls: ['<all_urls>'] },
  ['blocking'],
)

browser.webRequest.onBeforeRequest.addListener(
  handleBeforeRequestCheckIncognitoAccess,
  { urls: ['<all_urls>'] },
  ['blocking'],
)

/**
 * Check if proxy is ready to use.
 * Set proxy if proxying enabled and incognito access granted.
 * @returns {Promise<boolean>}
 */
const checkProxyReadiness = async () => {
  const proxyingEnabled = await proxy.enabled()
  const controlledByThisExtension = await proxy.controlledByThisExtension()
  const allowedIncognitoAccess = await browser.extension.isAllowedIncognitoAccess()

  if (proxyingEnabled && allowedIncognitoAccess) {
    if (!controlledByThisExtension) {
      await proxy.setProxy()
      await proxy.grantIncognitoAccess()
    }
    return true
  }
  console.warn('Proxy is not ready to use. Check if private browsing permissions granted.')
  return false
}

const handleTabState = async (tabId, changeInfo, { url: tabUrl }) => {
  const proxyingEnabled = await proxy.enabled()
  const extensionEnabled = await settings.extensionEnabled()

  if (changeInfo && changeInfo.status === browser.tabs.TabStatus.COMPLETE) {
    if (extensionEnabled && utilities.isValidURL(tabUrl) && !ignore.contains(tabUrl)) {
      await checkProxyReadiness()

      const urlBlocked = await registry.contains(tabUrl)
      const { url: disseminatorUrl, cooperationRefused } =
        await registry.retrieveInformationDisseminationOrganizerJSON(tabUrl)

      if (proxyingEnabled && urlBlocked) {
        settings.setBlockedIcon(tabId)
        return
      }

      if (disseminatorUrl) {
        settings.setDangerIcon(tabId)
        if (!cooperationRefused) {
          await showCooperationAcceptedWarning(tabUrl)
        }
      }
    }
  }
}

browser.tabs.onActivated.addListener(handleTabState)
browser.tabs.onUpdated.addListener(handleTabState)

const handleTabCreate = async ({ id }) => {
  const extensionEnabled = await settings.extensionEnabled()

  if (extensionEnabled) {
    await checkProxyReadiness()
  } else {
    settings.setDisableIcon(id)
  }
}

browser.tabs.onCreated.addListener(handleTabCreate)

const showCooperationAcceptedWarning = async (url) => {
  const hostname = utilities.extractHostnameFromUrl(url)
  const { notifiedHosts, showNotifications } = await storage.get({
    notifiedHosts: new Set(),
    showNotifications: true,
  })

  if (showNotifications) {
    if (!notifiedHosts.has(hostname)) {
      console.log(`Showing notification for ${hostname}`)
      await browser.notifications.create(hostname, {
        type: 'basic',
        title: settings.getName(),
        iconUrl: settings.getDangerIcon(),
        message: browser.i18n.getMessage('cooperationAcceptedMessage', hostname),
      })

      try {
        notifiedHosts.add(hostname)
        await storage.set({ notifiedHosts })
      } catch (error) {
        console.error(error)
      }
    }
  }
}

/**
 * Fired when the extension is first installed, when the extension is
 * updated to a new version, and when the browser is updated to a new version.
 * @param reason The reason that the runtime.onInstalled event is being dispatched.
 * @returns {Promise<void>}
 */
const handleInstalled = async ({ reason }) => {
  const reasonsForSync = [
    browser.runtime.OnInstalledReason.UPDATE,
    browser.runtime.OnInstalledReason.INSTALL,
  ]

  if (reason === browser.runtime.OnInstalledReason.INSTALL) {
    browser.tabs.create({
      url: browser.runtime.getURL('installed.html'),
    })
  }

  await settings.enableExtension()
  await settings.enableNotifications()

  if (reasonsForSync.includes(reason)) {
    const synchronized = await registry.sync()

    if (synchronized) {
      const allowedIncognitoAccess =
        await browser.extension.isAllowedIncognitoAccess()

      if (allowedIncognitoAccess) {
        console.warn('onInstall: incognito access allowed, setting proxy...')
        await proxy.setProxy()
      } else {
        await proxy.requestIncognitoAccess()
      }
    }
  }
  await proxy.ping()
}

browser.runtime.onInstalled.addListener(handleInstalled)

/**
 * Fired when one or more items change.
 * @param changes Object describing the change. This contains one property for each key that changed.
 * @param _areaName The name of the storage area ("sync", "local") to which the changes were made.
 */
const handleStorageChanged = async ({ enableExtension, ignoredHosts, useProxy }, _areaName) => {
  if (enableExtension) {
    const newValue = enableExtension.newValue
    const oldValue = enableExtension.oldValue

    if (newValue === true && oldValue === false) {
      await proxy.setProxy()
    }

    if (newValue === false && oldValue === true) {
      await proxy.removeProxy()
    }
  }

  if (useProxy && enableExtension === undefined) {
    const newValue = useProxy.newValue
    const oldValue = useProxy.oldValue

    const extensionEnabled = settings.extensionEnabled()

    if (extensionEnabled) {
      if (newValue === true && oldValue === false) {
        await proxy.setProxy()
      }

      if (newValue === false && oldValue === true) {
        await proxy.removeProxy()
      }
    }
  }
}

browser.storage.onChanged.addListener(handleStorageChanged)

// Debug namespaces.
window.censortracker = {
  proxy,
  registry,
  settings,
  storage,
  ignore,
}
