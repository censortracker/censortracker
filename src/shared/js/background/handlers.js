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
        storage.get({ parentalControl: false })
          .then(({ parentalControl }) => {
            port.postMessage({ parentalControl })
          })
      }
    })
  }
}

export const warnAboutInformationDisseminationOrganizer = async (url) => {
  const hostname = utilities.extractHostnameFromUrl(url)
  const { notifiedHosts, showNotifications } = await storage.get({
    notifiedHosts: [],
    showNotifications: true,
  })

  if (showNotifications && !notifiedHosts.includes(hostname)) {
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

export const handleOnAlarm = async ({ name }) => {
  console.warn(`Alarm received: ${name}`)

  if (name === 'ignore-fetch') {
    await Ignore.fetch()
  }

  if (name === 'proxy-setProxy') {
    const proxyingEnabled = await ProxyManager.isEnabled()

    if (proxyingEnabled) {
      await ProxyManager.setProxy()
    }
  }

  if (name === 'registry-sync') {
    await Registry.sync()
  }
}

export const handleBeforeRequest = async (_details) => {
  await ProxyManager.ping()
  await ProxyManager.requestIncognitoAccess()
}

export const handleStartup = async () => {
  console.groupCollapsed('onStartup')
  await Ignore.fetch()
  await Registry.sync()

  const proxyingEnabled = await ProxyManager.isEnabled()

  if (proxyingEnabled) {
    await ProxyManager.setProxy()
  }

  await Task.schedule([
    { name: 'ignore-fetch', minutes: 10 },
    { name: 'registry-sync', minutes: 20 },
    { name: 'proxy-setProxy', minutes: 10 },
  ])
  console.groupEnd()
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
  const proxyingEnabled = await ProxyManager.isEnabled()
  const enableExtension = await Settings.extensionEnabled()

  if (customProxiedDomains && customProxiedDomains.newValue) {
    if (enableExtension && proxyingEnabled) {
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
      const enableExtensionNewValue = enableExtension.newValue
      const enableExtensionOldValue = enableExtension.oldValue

      console.log(`enableExtension: ${enableExtensionOldValue} -> ${enableExtensionNewValue}`)

      Browser.tabs.query({}).then((tabs) => {
        for (const { id } of tabs) {
          if (enableExtensionNewValue) {
            Settings.setDefaultIcon(id)
          } else {
            Settings.setDisableIcon(id)
          }
        }
      })

      if (enableExtensionNewValue === true && enableExtensionOldValue === false) {
        await ProxyManager.setProxy()
      }

      if (enableExtensionNewValue === false && enableExtensionOldValue === true) {
        await ProxyManager.removeProxy()
      }
    }

    if (useProxy && enableExtension === undefined) {
      const useProxyNewValue = useProxy.newValue
      const useProxyOldValue = useProxy.oldValue

      console.log(`useProxy: ${useProxyOldValue} -> ${useProxyNewValue}`)

      const extensionEnabled = await Settings.extensionEnabled()

      if (extensionEnabled) {
        if (useProxyNewValue === true && useProxyOldValue === false) {
          await ProxyManager.setProxy()
        }

        if (useProxyNewValue === false && useProxyOldValue === true) {
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
  const UPDATED = reason === Browser.runtime.OnInstalledReason.UPDATE
  const INSTALLED = reason === Browser.runtime.OnInstalledReason.INSTALL

  console.groupCollapsed('onInstall')
  // In Firefox, the UPDATE can be caused after granting incognito access.
  if (UPDATED && Browser.IS_FIREFOX) {
    const controlledByThisExtension = await ProxyManager.controlledByThisExtension()
    const isAllowedIncognitoAccess = await Browser.extension.isAllowedIncognitoAccess()

    if (isAllowedIncognitoAccess && !controlledByThisExtension) {
      console.warn('Incognito access granted, setting proxy...')
      await ProxyManager.setProxy()
    }
  }

  if (INSTALLED) {
    await Settings.enableExtension()
    await Settings.enableNotifications()
    await Settings.showInstalledPage()
    await ProxyManager.enableProxy()

    const synchronized = await Registry.sync()

    if (synchronized) {
      await ProxyManager.requestIncognitoAccess()
      await ProxyManager.ping()
      await ProxyManager.setProxy()
    } else {
      console.warn('Synchronization failed')
    }
  }

  if (UPDATED || INSTALLED) {
    await Task.schedule([
      { name: 'ignore-fetch', minutes: 10 },
      { name: 'registry-sync', minutes: 20 },
      { name: 'proxy-setProxy', minutes: 10 },
    ])
  }
  console.groupEnd()
}

export const handleTabState = async (tabId, { status = 'loading' } = {}, tab) => {
  if (status === Browser.tabs.TabStatus.LOADING) {
    const isIgnored = await Ignore.contains(tab.url)
    const extensionEnabled = await Settings.extensionEnabled()

    if (extensionEnabled && !isIgnored && utilities.isValidURL(tab.url)) {
      const blocked = await Registry.contains(tab.url)
      const { url: disseminatorUrl, cooperationRefused } =
        await Registry.retrieveInformationDisseminationOrganizerJSON(tab.url)

      if (blocked) {
        Settings.setBlockedIcon(tabId)
      } else if (disseminatorUrl) {
        Settings.setDangerIcon(tabId)
        if (!cooperationRefused) {
          await warnAboutInformationDisseminationOrganizer(tab.url)
        }
      }
    }
  }
}

export const handleTabCreate = async (tab) => {
  const extensionEnabled = await Settings.extensionEnabled()

  if (extensionEnabled) {
    Settings.setDefaultIcon(tab.id)
  } else {
    Settings.setDisableIcon(tab.id)
  }
}
