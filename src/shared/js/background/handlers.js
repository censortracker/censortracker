import Ignore from './ignore'
import ProxyManager from './proxy'
import Registry from './registry'
import * as server from './server'
import Settings from './settings'
import * as storage from './storage'
import Task from './task'
import * as utilities from './utilities'
import Browser from './webextension'

export const handleOnConnect = (port) => {
  if (port.name === 'censortracker') {
    port.onMessage.addListener((message) => {
      if (message.parentalControl === '?') {
        storage.get({ parentalControl: false }).then(({ parentalControl }) => {
          port.postMessage({ parentalControl })
        })
      }
    })
  }
}

export const warnAboutInformationDisseminationOrganizer = async (url) => {
  const hostname = utilities.extractDomainFromUrl(url)
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
  console.warn(`Task received: ${name}`)

  if (name === 'sync') {
    await server.synchronize()
  }

  if (name === 'setProxy') {
    ProxyManager.isEnabled()
      .then(async (proxyingEnabled) => {
        if (proxyingEnabled) {
          await ProxyManager.setProxy()
        }
      })
  }
}

export const handleBeforeRequest = async (_details) => {
  await ProxyManager.ping()
  await ProxyManager.requestIncognitoAccess()
}

export const handleStartup = async () => {
  console.groupCollapsed('onStartup')

  const proxyingEnabled = await ProxyManager.isEnabled()

  if (proxyingEnabled) {
    await ProxyManager.setProxy()
  }

  await Task.schedule([
    { name: 'sync', minutes: 20 },
    { name: 'setProxy', minutes: 10 },
  ])
  console.groupEnd()
}

export const handleProxyError = (details) => {
  console.error(`Proxy error: ${JSON.stringify(details)}`)
}

export const handleIgnoredHostsChange = async (
  { ignoredHosts = {} } = {},
  _areaName,
) => {
  if ('newValue' in ignoredHosts) {
    console.log('The list of ignored hosts has been updated.')
    ProxyManager.isEnabled()
      .then((enabled) => {
        if (enabled) {
          ProxyManager.setProxy()
            .then((proxySet) => {
              if (proxySet) {
                console.log('Regenerating PAC...')
              } else {
                console.error('Failed to regenerate PAC.')
              }
            })
        } else {
          console.warn(
            'PAC could not be regenerated, since proxying is disabled.',
          )
        }
      })
  }
}

export const handleCustomProxiedDomainsChange = async (
  { customProxiedDomains },
  _areaName,
) => {
  Settings.extensionEnabled().then((enableExtension) => {
    ProxyManager.isEnabled().then(async (proxyingEnabled) => {
      if (customProxiedDomains && customProxiedDomains.newValue) {
        if (enableExtension && proxyingEnabled) {
          await ProxyManager.setProxy()
          console.warn('Updated custom proxied domains.')
        }
      }
    })
  })
}

/**
 * Fired when one or more items change.
 * @param changes Object describing the change. This contains one property for each key that changed.
 * @param _areaName The name of the storage area ("sync", "local") to which the changes were made.
 */
export const handleStorageChanged = async (
  { enableExtension, useProxy },
  _areaName,
) => {
  if (enableExtension || useProxy) {
    if (enableExtension) {
      const enableExtensionNewValue = enableExtension.newValue
      const enableExtensionOldValue = enableExtension.oldValue

      console.log(
        `enableExtension: ${enableExtensionOldValue} -> ${enableExtensionNewValue}`,
      )

      Browser.tabs.query({}).then((tabs) => {
        for (const { id } of tabs) {
          if (enableExtensionNewValue) {
            Settings.setDefaultIcon(id)
          } else {
            Settings.setDisableIcon(id)
          }
        }
      })

      if (
        enableExtensionNewValue === true &&
        enableExtensionOldValue === false
      ) {
        await ProxyManager.setProxy()
      }

      if (
        enableExtensionNewValue === false &&
        enableExtensionOldValue === true
      ) {
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

  // In Firefox, the UPDATE can be caused after granting incognito access.
  if (UPDATED && Browser.IS_FIREFOX) {
    const controlledByThisExtension =
      await ProxyManager.controlledByThisExtension()
    const isAllowedIncognitoAccess =
      await Browser.extension.isAllowedIncognitoAccess()

    if (isAllowedIncognitoAccess && !controlledByThisExtension) {
      console.warn('Incognito access granted, setting proxy...')
      await ProxyManager.setProxy()
    }
  }

  if (INSTALLED) {
    await Registry.enableRegistry()
    await Settings.enableExtension()
    await Settings.enableNotifications()
    await Settings.showInstalledPage()
    await ProxyManager.enableProxy()

    await server.synchronize()
    await ProxyManager.requestIncognitoAccess()
    await ProxyManager.ping()
    await ProxyManager.setProxy()
  }

  if (UPDATED || INSTALLED) {
    await Task.schedule([
      { name: 'sync', minutes: 20 },
      { name: 'setProxy', minutes: 10 },
    ])
  }
}

export const handleTabState = async (
  tabId,
  { status = 'loading' } = {},
  tab,
) => {
  if (status === Browser.tabs.TabStatus.LOADING) {
    Ignore.contains(tab.url).then((isIgnored) => {
      Settings.extensionEnabled().then(async (extensionEnabled) => {
        if (extensionEnabled && !isIgnored && utilities.isValidURL(tab.url)) {
          const blocked = await Registry.contains(tab.url)
          const { url: disseminatorUrl, cooperationRefused } =
            await Registry.retrieveDisseminator(
              tab.url,
            )

          if (blocked) {
            Settings.setBlockedIcon(tabId)
          } else if (disseminatorUrl) {
            if (!cooperationRefused) {
              Settings.setDangerIcon(tabId)
              await warnAboutInformationDisseminationOrganizer(tab.url)
            }
          }
        }
      })
    })
  }
}

export const handleTabCreate = async (tab) => {
  Settings.extensionEnabled()
    .then((enabled) => {
      if (enabled) {
        Settings.setDefaultIcon(tab.id)
      } else {
        Settings.setDisableIcon(tab.id)
      }
    })
}
