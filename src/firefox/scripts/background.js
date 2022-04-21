import {
//   handleBeforeRequestPing,
//   handleCustomProxiedDomainsChange,
//   handleIgnoredHostsChange,
//   handleProxyError,
//   handleStartup,
} from '@/shared/scripts/handlers'
import Ignore from '@/shared/scripts/ignore'
import ProxyManager from '@/shared/scripts/proxy'
import Registry from '@/shared/scripts/registry'
import Settings from '@/shared/scripts/settings'
import * as storage from '@/shared/scripts/storage'
import * as utilities from '@/shared/scripts/utilities'

// browser.runtime.onStartup.addListener(handleStartup)
// browser.proxy.onError.addListener(handleProxyError)
// browser.storage.onChanged.addListener(handleIgnoredHostsChange)
// browser.storage.onChanged.addListener(handleCustomProxiedDomainsChange)

// const handleBeforeRequestCheckIncognitoAccess = async (_details) => {
//   const allowed = await browser.extension.isAllowedIncognitoAccess()
//
//   if (!allowed) {
//     await ProxyManager.requestIncognitoAccess()
//   }
// }

// browser.webRequest.onBeforeRequest.addListener(
//   handleBeforeRequestPing,
//   { urls: ['<all_urls>'] },
//   ['blocking'],
// )

// browser.webRequest.onBeforeRequest.addListener(
//   handleBeforeRequestCheckIncognitoAccess,
//   { urls: ['<all_urls>'] },
//   ['blocking'],
// )

/**
 * Check if proxy is ready to use.
 * Set proxy if proxying enabled and incognito access granted.
 * @returns {Promise<boolean>}
 */
// const checkProxyReadiness = async () => {
//   const proxyingEnabled = await ProxyManager.enabled()
//   const controlledByThisExtension = await ProxyManager.controlledByThisExtension()
//   const allowedIncognitoAccess = await browser.extension.isAllowedIncognitoAccess()
//
//   if (proxyingEnabled && allowedIncognitoAccess) {
//     if (!controlledByThisExtension) {
//       await ProxyManager.setProxy()
//       await ProxyManager.grantIncognitoAccess()
//     }
//     return true
//   }
//   console.warn('Proxy is not ready to use. Check if private browsing permissions granted.')
//   return false
// }

// eslint-disable-next-line no-unused-vars
const handleTabState = async (tabId, changeInfo, { url: tabUrl }) => {
  const isIgnored = await Ignore.contains(tabUrl)
  const proxyingEnabled = await ProxyManager.enabled()
  const extensionEnabled = await Settings.extensionEnabled()

  if (changeInfo && changeInfo.status === browser.tabs.TabStatus.COMPLETE) {
    if (extensionEnabled && !isIgnored && utilities.isValidURL(tabUrl)) {
      // await checkProxyReadiness()

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
          await showCooperationAcceptedWarning(tabUrl)
        }
      }
    }
  }
}

// browser.tabs.onActivated.addListener(handleTabState)
// browser.tabs.onUpdated.addListener(handleTabState)

const handleTabCreate = async ({ id }) => {
  const extensionEnabled = await Settings.extensionEnabled()

  if (extensionEnabled) {
    // await checkProxyReadiness()
  } else {
    Settings.setDisableIcon(id)
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
        title: Settings.getName(),
        iconUrl: Settings.getDangerIcon(),
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
  console.group('onInstall')

  console.group('Settings')
  await Settings.enableExtension()
  await Settings.enableNotifications()
  console.groupEnd()

  if (reason === browser.runtime.OnInstalledReason.INSTALL) {
    await browser.tabs.create({ url: 'installed.html' })

    const synchronized = await Registry.sync()

    if (synchronized) {
      const allowedIncognitoAccess =
        await browser.extension.isAllowedIncognitoAccess()

      if (allowedIncognitoAccess) {
        console.warn('Incognito access allowed, setting proxy...')
        await ProxyManager.setProxy()
      } else {
        await ProxyManager.requestIncognitoAccess()
      }
    } else {
      console.warn('Synchronization failed')
    }
  }
  await ProxyManager.ping()
  console.groupEnd()
}

browser.runtime.onInstalled.addListener(handleInstalled)

/**
 * Fired when one or more items change.
 * @param changes Object describing the change. This contains one property for each key that changed.
 * @param _areaName The name of the storage area ("sync", "local") to which the changes were made.
 */
// const handleStorageChanged = async ({ enableExtension, ignoredHosts, useProxy }, _areaName) => {
//   if (enableExtension) {
//     const newValue = enableExtension.newValue
//     const oldValue = enableExtension.oldValue
//
//     if (newValue === true && oldValue === false) {
//       await ProxyManager.setProxy()
//     }
//
//     if (newValue === false && oldValue === true) {
//       await ProxyManager.removeProxy()
//     }
//   }
//
//   if (useProxy && enableExtension === undefined) {
//     const newValue = useProxy.newValue
//     const oldValue = useProxy.oldValue
//
//     const extensionEnabled = Settings.extensionEnabled()
//
//     if (extensionEnabled) {
//       if (newValue === true && oldValue === false) {
//         await ProxyManager.setProxy()
//       }
//
//       if (newValue === false && oldValue === true) {
//         await ProxyManager.removeProxy()
//       }
//     }
//   }
// }

// browser.storage.onChanged.addListener(handleStorageChanged)

// // Debug namespaces.
window.censortracker = {
  ProxyManager,
  Registry,
  Settings,
  storage,
  Ignore,
}
