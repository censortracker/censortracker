import Browser from './browser-api'
import { TaskType } from './constants'
import Ignore from './ignore'
import ProxyManager from './proxy'
import Registry from './registry'
import * as server from './server'
import Settings from './settings'
import Task from './task'
import * as utilities from './utilities'

/**
 * Fired when a connection is made from a content script.
 * @param port A runtime.Port object representing the port connection.
 */
export const handleOnConnect = (port) => {
  if (port.name === 'censortracker') {
    port.onMessage.addListener((message) => {
      if (message.parentalControl === '?') {
        Browser.storage.local.get({ parentalControl: false })
          .then(({ parentalControl }) => {
            port.postMessage({ parentalControl })
          })
      }
    })
  }
}

export const showDisseminatorWarning = async (url) => {
  const hostname = utilities.extractDomainFromUrl(url)
  const {
    notifiedHosts,
    showNotifications,
  } = await Browser.storage.local.get({
    notifiedHosts: [],
    showNotifications: true,
  })

  if (showNotifications && !notifiedHosts.includes(hostname)) {
    await Browser.notifications.create(hostname, {
      type: 'basic',
      title: Settings.getName(),
      iconUrl: Settings.getDangerIcon(),
      message: Browser.i18n.getMessage('cooperationAcceptedMessage', hostname),
    })

    try {
      notifiedHosts.push(hostname)
      await Browser.storage.local.set({ notifiedHosts })
    } catch (error) {
      console.error(error)
    }
  }
}

export const handleOnAlarm = async ({ name }) => {
  console.log(`Task received: ${name}`)

  if (name === TaskType.PING) {
    await ProxyManager.ping()
  } else if (name === TaskType.REMOVE_BAD_PROXIES) {
    await ProxyManager.removeBadProxies()
  } else if (name === TaskType.SET_PROXY) {
    const proxyingEnabled = await ProxyManager.isEnabled()

    if (proxyingEnabled) {
      await server.synchronize()
      await ProxyManager.setProxy()
    }
  } else {
    console.warn(`Unknown task: ${name}`)
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
    { name: TaskType.PING, minutes: 5 },
    { name: TaskType.SET_PROXY, minutes: 8 },
    { name: TaskType.REMOVE_BAD_PROXIES, minutes: 5 },
  ])
  console.groupEnd()
}

export const handleIgnoredHostsChange = async (
  { ignoredHosts = {} } = {},
  _areaName,
) => {
  if ('newValue' in ignoredHosts) {
    ProxyManager.isEnabled().then((enabled) => {
      if (enabled) {
        ProxyManager.setProxy().then((proxySet) => {})
      }
    })
  }
}

export const handleCustomProxiedDomainsChange = async (
  { customProxiedDomains: { newValue } = {} } = {},
  _areaName,
) => {
  Settings.extensionEnabled().then((enableExtension) => {
    if (enableExtension && newValue) {
      ProxyManager.isEnabled().then(async (proxyingEnabled) => {
        if (proxyingEnabled) {
          await ProxyManager.setProxy()
        }
      })
    }
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
        await ProxyManager.disableProxy()
        await ProxyManager.removeProxy()
      }
    }

    if (useProxy && enableExtension === undefined) {
      const useProxyNewValue = useProxy.newValue
      const useProxyOldValue = useProxy.oldValue
      const extensionEnabled = await Settings.extensionEnabled()

      if (extensionEnabled) {
        if (useProxyNewValue === true && useProxyOldValue === false) {
          await ProxyManager.setProxy()
        }

        if (useProxyNewValue === false && useProxyOldValue === true) {
          await ProxyManager.disableProxy()
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

  if (INSTALLED) {
    await Settings.showInstalledPage()
  }

  if (UPDATED || INSTALLED) {
    await Registry.enableRegistry()
    await Settings.enableExtension()
    await Settings.enableNotifications()

    await server.synchronize()
    await ProxyManager.enableProxy()
    await ProxyManager.requestIncognitoAccess()
    await ProxyManager.setProxy()
    await ProxyManager.ping()

    // Schedule tasks to run in the background.
    await Task.schedule([
      { name: TaskType.SET_PROXY, minutes: 8 },
      { name: TaskType.REMOVE_BAD_PROXIES, minutes: 5 },
    ])
  }
}

export const handleTabState = async (
  tabId,
  { status = 'loading' } = {},
  { url } = {},
) => {
  if (url && status === Browser.tabs.TabStatus.LOADING) {
    Settings.extensionEnabled().then((enabled) => {
      if (enabled) {
        Ignore.contains(url).then(async (isIgnored) => {
          Registry.retrieveDisseminator(url).then(
            async ({ url: disseminatorUrl, cooperationRefused }) => {
              if (disseminatorUrl) {
                if (!cooperationRefused) {
                  Settings.setDangerIcon(tabId)
                  await showDisseminatorWarning(url)
                }
              }
            },
          )

          if (!isIgnored) {
            Registry.contains(url).then((blocked) => {
              if (blocked) {
                Settings.setBlockedIcon(tabId)
              }
            })
          }
        })
      } else {
        Settings.setDisableIcon(tabId)
      }
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

export const handleProxyError = async ({ error }) => {
  const usingCustomProxy = await ProxyManager.usingCustomProxy()

  // Custom proxy is used, so we don't need to handle this error
  if (usingCustomProxy) {
    return
  }

  error = error.replace('net::', '')

  const proxyErrors = [
    // Firefox
    'NS_ERROR_UNKNOWN_PROXY_HOST',
    // Chrome
    'ERR_PROXY_CONNECTION_FAILED',
  ]

  if (proxyErrors.includes(error)) {
    const {
      currentProxyServer,
      fallbackProxyInUse,
    } = await Browser.storage.local.get({
      fallbackProxyInUse: false,
      currentProxyServer: null,
    })

    if (fallbackProxyInUse) {
      await Browser.storage.local.set({
        proxyIsAlive: false,
        fallbackProxyError: error,
      })
      console.warn('Fallback proxy is intermittent, interrupting auto fetch...')
      return
    }

    console.error(`Error on connection to ${currentProxyServer}: ${error}`)

    if (currentProxyServer) {
      const badProxies = await ProxyManager.getBadProxies()

      if (!badProxies.includes(currentProxyServer)) {
        badProxies.push(currentProxyServer)
        await Browser.storage.local.set({ badProxies })
      }

      Browser.tabs.query({
        active: true,
        lastFocusedWindow: true,
      }).then(async (tab) => {
        console.warn('Requesting new proxy server...')
        await server.synchronize({
          syncIgnore: false,
          syncRegistry: false,
          syncProxy: true,
        })
        await ProxyManager.setProxy()
        await ProxyManager.ping()
      })
    }
  }
}

export const handleOnUpdateAvailable = async ({ version }) => {
  await Browser.storage.local.set({ updateAvailable: true })
  console.warn(`Update available: ${version}`)
}
