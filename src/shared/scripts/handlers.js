import Ignore from './ignore'
import ProxyManager from './proxy'
import Registry from './registry'
import Settings from './settings'
import * as storage from './storage'
import Task from './task'
import * as utilities from './utilities'
import Browser from './webextension'

export const handleOnConnect = (port) => {
  if (port.name === 'censortracker') {
    port.onMessage.addListener((message) => {
      if (message.parentalControl === '?') {
        storage.get({ parentalControl: false }).then(
          ({ parentalControl }) => {
            port.postMessage({ parentalControl })
          },
        )
      }
    })
  }
}

export const handleInformationDisseminationOrganizer = async (url) => {
  const hostname = utilities.extractHostnameFromUrl(url)
  const { notifiedHosts, showNotifications } = await storage.get({
    notifiedHosts: [],
    showNotifications: true,
  })

  if (showNotifications) {
    if (!notifiedHosts.includes(hostname)) {
      console.log(`Showing notification for ${hostname}`)

      await Browser.notifications.create(hostname, {
        type: 'basic',
        title: Settings.getName(),
        iconUrl: Settings.getDangerIcon(),
        message: Browser.i18n.getMessage('cooperationAcceptedMessage', hostname),
      })

      try {
        notifiedHosts.push(hostname)
        await storage.set({ notifiedHosts })
      } catch (error) {
        console.error(error)
      }
    }
  }
}

export const handleOnAlarm = async ({ name }) => {
  console.warn(`Alarm received: ${name}`)

  if (name === 'ignore-fetch') {
    await Ignore.fetch()
  }

  if (name === 'proxy-setProxy') {
    await ProxyManager.setProxy()
  }

  if (name === 'registry-sync') {
    await Registry.sync()
  }
}

export const handleBeforeRequest = async (_details) => {
  if (Browser.isFirefox) {
    const allowed = await browser.extension.isAllowedIncognitoAccess()

    if (!allowed) {
      await ProxyManager.requestIncognitoAccess()
    }
  }
  await ProxyManager.ping()
}

export const handleStartup = async () => {
  await ProxyManager.setProxy()
}

export const handleProxyError = (details) => {
  console.error(`Proxy error: ${JSON.stringify(details)}`)
}

export const handleIgnoredHostsChange = async ({ ignoredHosts }, _areaName) => {
  if (ignoredHosts && ignoredHosts.newValue) {
    await ProxyManager.setProxy()
  }
}

export const handleCustomProxiedDomainsChange = async ({ customProxiedDomains }, _areaName) => {
  const { enableExtension } = await storage.get({ enableExtension: false })

  if (customProxiedDomains && customProxiedDomains.newValue) {
    if (enableExtension) {
      await ProxyManager.setProxy()
      console.warn('Updated custom proxied domains.')
    }
  }
}

/**
 * Fired when one or more items change.
 * @param changes Object describing the change. This contains one property for each key that changed.
 * @param _areaName The name of the storage area ("sync", "local") to which the changes were made.
 */
export const handleStorageChanged = async ({ enableExtension, ignoredHosts, useProxy }, _areaName) => {
  if (enableExtension || ignoredHosts || useProxy) {
    console.group('handleStorageChanged')

    if (enableExtension) {
      const newValue = enableExtension.newValue
      const oldValue = enableExtension.oldValue

      console.log(`enableExtension: ${oldValue} -> ${newValue}`)

      if (newValue === true && oldValue === false) {
        await ProxyManager.setProxy()
      }

      if (newValue === false && oldValue === true) {
        await ProxyManager.removeProxy()
      }
    }

    if (useProxy && enableExtension === undefined) {
      const newValue = useProxy.newValue
      const oldValue = useProxy.oldValue

      console.log(`useProxy: ${oldValue} -> ${newValue}`)

      const extensionEnabled = await Settings.extensionEnabled()

      if (extensionEnabled) {
        if (newValue === true && oldValue === false) {
          await ProxyManager.setProxy()
        }

        if (newValue === false && oldValue === true) {
          await ProxyManager.removeProxy()
        }
      }
    }
    console.groupEnd()
  }
}

/**
 * Fired when the extension is first installed, when the extension is
 * updated to a new version, and when the browser is updated to a new version.
 * @param reason The reason that the runtime.onInstalled event is being dispatched.
 * @returns {Promise<void>}
 */
export const handleInstalled = async ({ reason }) => {
  if (reason === Browser.runtime.OnInstalledReason.INSTALL) {
    console.group('onInstall')

    await Settings.enableExtension()
    await Settings.enableNotifications()
    await Settings.showInstalledPage()

    await Task.schedule([
      { name: 'ignore-fetch', minutes: 10 },
      { name: 'registry-sync', minutes: 20 },
      { name: 'proxy-setProxy', minutes: 10 },
    ])

    const synchronized = await Registry.sync()

    if (synchronized) {
      const allowedIncognitoAccess =
        await Browser.extension.isAllowedIncognitoAccess()

      if (!allowedIncognitoAccess) {
        await ProxyManager.requestIncognitoAccess()
      }
      await ProxyManager.ping()
      await ProxyManager.setProxy()
    } else {
      console.warn('Synchronization failed')
    }
    console.groupEnd()
  }
}

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

export const handleTabState = async (tabId, changeInfo, tab) => {
  if (changeInfo && changeInfo.status === Browser.tabs.TabStatus.COMPLETE) {
    const isIgnored = await Ignore.contains(tab.url)
    const proxyingEnabled = await ProxyManager.enabled()
    const extensionEnabled = await Settings.extensionEnabled()

    if (extensionEnabled && !isIgnored && utilities.isValidURL(tab.url)) {
      if (Browser.isFirefox) {
        await checkProxyReadiness()
      }

      const urlBlocked = await Registry.contains(tab.url)
      const { url: disseminatorUrl, cooperationRefused } =
        await Registry.retrieveInformationDisseminationOrganizerJSON(tab.url)

      if (proxyingEnabled && urlBlocked) {
        Settings.setBlockedIcon(tabId)
        return
      }

      if (disseminatorUrl) {
        Settings.setDangerIcon(tabId)
        if (!cooperationRefused) {
          await handleInformationDisseminationOrganizer(tab.url)
        }
      }
    }
  }
}

export const handleTabCreate = async ({ id }) => {
  const extensionEnabled = await Settings.extensionEnabled()

  if (extensionEnabled) {
    if (Browser.isFirefox) {
      await checkProxyReadiness()
    } else {
      Settings.setDefaultIcon(id)
    }
  } else {
    Settings.setDisableIcon(id)
  }
}
