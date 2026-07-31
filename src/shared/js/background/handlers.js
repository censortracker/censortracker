import browser from './browser-api'
import { ProxyMode, TaskType } from './constants'
import Ignore from './ignore'
import ProxyManager from './proxy'
import Registry from './registry'
import * as server from './server'
import Settings from './settings'
import Task from './task'
import * as utilities from './utilities'

export const showDisseminatorWarning = async (url) => {
  const hostname = utilities.extractDomainFromUrl(url)
  const {
    notifiedHosts,
    showNotifications,
  } = await browser.storage.local.get({
    notifiedHosts: [],
    showNotifications: true,
  })

  if (showNotifications && !notifiedHosts.includes(hostname)) {
    await browser.notifications.create(hostname, {
      type: 'basic',
      title: Settings.getName(),
      iconUrl: Settings.getDangerIcon(),
      message: browser.i18n.getMessage('cooperationAcceptedMessage', hostname),
    })

    try {
      notifiedHosts.push(hostname)
      await browser.storage.local.set({ notifiedHosts })
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
  } else if (name === TaskType.CHECK_LOCAL_PROXY) {
    await ProxyManager.syncLocalProxy()
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

  await scheduleLocalProxyCheck()
  // Refreshes «localProxyAlive» before the PAC is built out of it, so
  // that a proxy which died while the browser was closed is not used.
  // Does nothing unless the local proxy is the selected mode.
  await ProxyManager.syncLocalProxy()

  const proxyingEnabled = await ProxyManager.isEnabled()

  if (proxyingEnabled) {
    await ProxyManager.setProxy()
  }

  await Task.schedule([
    { name: TaskType.PING, minutes: 10 },
    { name: TaskType.SET_PROXY, minutes: 15 },
    { name: TaskType.REMOVE_BAD_PROXIES, minutes: 20 },
  ])
  console.groupEnd()
}

/**
 * Keeps the local proxy watcher running only while the local proxy
 * is the selected mode, so that localhost is not polled otherwise.
 * @returns {Promise<void>}
 */
export const scheduleLocalProxyCheck = async () => {
  const mode = await ProxyManager.getMode()

  if (mode === ProxyMode.LOCAL) {
    await Task.schedule([
      { name: TaskType.CHECK_LOCAL_PROXY, minutes: 1 },
    ])
  } else {
    await Task.cancel(TaskType.CHECK_LOCAL_PROXY)
  }
}

/**
 * Fired when the user switches between default, custom and local proxy.
 * @param proxyMode Object describing the change of the «proxyMode» key.
 * @param _areaName The name of the storage area.
 */
export const handleProxyModeChange = async (
  { proxyMode } = {},
  _areaName,
) => {
  if (!proxyMode || !('newValue' in proxyMode)) {
    return
  }

  console.log(`proxyMode: ${proxyMode.oldValue} -> ${proxyMode.newValue}`)
  await scheduleLocalProxyCheck()
}

// Both listeners below are awaited from top to bottom on purpose: an
// async listener which returns before its own chain is done may be cut
// short by the service worker shutting down, and then the change never
// reaches the PAC.
export const handleIgnoredHostsChange = async (
  { ignoredHosts = {} } = {},
  _areaName,
) => {
  if (!('newValue' in ignoredHosts)) {
    return
  }

  if (await ProxyManager.isEnabled()) {
    await ProxyManager.setProxy()
  }
}

export const handleCustomProxiedDomainsChange = async (
  { customProxiedDomains: { newValue } = {} } = {},
  _areaName,
) => {
  if (!newValue) {
    return
  }

  const extensionEnabled = await Settings.extensionEnabled()

  if (extensionEnabled && await ProxyManager.isEnabled()) {
    await ProxyManager.setProxy()
  }
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
  if (!enableExtension && !useProxy) {
    return
  }

  if (enableExtension) {
    const enableExtensionNewValue = enableExtension.newValue

    console.log(
      `enableExtension: ${enableExtension.oldValue} -> ${enableExtensionNewValue}`,
    )

    browser.tabs.query({}).then((tabs) => {
      for (const { id } of tabs) {
        if (enableExtensionNewValue) {
          Settings.setDefaultIcon(id)
        } else {
          Settings.setDisableIcon(id)
        }
      }
    })
  }

  const extensionTurnedOff =
    enableExtension && enableExtension.newValue === false
  const proxyingTurnedOff = useProxy && useProxy.newValue === false

  // Tearing proxying down must not depend on anything else: whenever
  // either switch goes off, the browser has to stop using our PAC. Both
  // may arrive in a single change, hence one branch for the two.
  if (extensionTurnedOff || proxyingTurnedOff) {
    if (extensionTurnedOff) {
      await ProxyManager.disableProxy()
    }
    await ProxyManager.removeProxy()
    return
  }

  const turnedOn =
    (enableExtension && enableExtension.newValue === true) ||
    (useProxy && useProxy.newValue === true)

  if (
    turnedOn &&
    await Settings.extensionEnabled() &&
    await ProxyManager.isEnabled()
  ) {
    await ProxyManager.setProxy()
  }
}

/**
 * Fired when the extension is first installed, when the extension is
 * updated to a new version, and when the browser is updated to a new version.
 * @param reason The reason that the runtime.onInstalled event is being dispatched.
 * @returns {Promise<void>}
 */
export const handleInstalled = async ({ reason }) => {
  const UPDATED = reason === browser.runtime.OnInstalledReason.UPDATE
  const INSTALLED = reason === browser.runtime.OnInstalledReason.INSTALL

  // if (INSTALLED) {
  //   await Settings.showInstalledPage()
  // }

  if (UPDATED || INSTALLED) {
    await Registry.enableRegistry()
    await Settings.enableExtension()
    await Settings.enableNotifications()

    await server.synchronize()

    // Updating the extension must not turn proxying back on for those
    // who turned it off: it's a user setting, not an install-time default.
    if (INSTALLED) {
      await ProxyManager.enableProxy()
    }

    await ProxyManager.requestIncognitoAccess()
    await scheduleLocalProxyCheck()
    await ProxyManager.syncLocalProxy()
    await ProxyManager.setProxy()
    await ProxyManager.ping()

    // Schedule tasks to run in the background.
    await Task.schedule([
      { name: TaskType.SET_PROXY, minutes: 15 },
      { name: TaskType.REMOVE_BAD_PROXIES, minutes: 5 },
    ])
  }
}

export const handleTabState = async (
  tabId,
  { status = 'loading' } = {},
  { url } = {},
) => {
  if (url && status === browser.tabs.TabStatus.LOADING) {
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
  if (!error) {
    return
  }

  error = error.replace('net::', '')

  const proxyErrors = [
    // Firefox
    'NS_ERROR_UNKNOWN_PROXY_HOST',
    'NS_ERROR_PROXY_CONNECTION_REFUSED',
    // Chrome
    'ERR_PROXY_CONNECTION_FAILED',
    'ERR_SOCKS_CONNECTION_FAILED',
    'ERR_TUNNEL_CONNECTION_FAILED',
  ]

  // Errors which mean the proxy server itself is unusable and another
  // one has to be requested. Kept narrow on purpose: a single website
  // failing must not get our proxy server blacklisted.
  const unusableProxyErrors = [
    'NS_ERROR_UNKNOWN_PROXY_HOST',
    'ERR_PROXY_CONNECTION_FAILED',
  ]

  if (proxyErrors.includes(error)) {
    const mode = await ProxyManager.getMode()

    // The Amnezia local proxy is not ours: it either moved to another
    // port or is gone. Rechecking it either picks up the new port or
    // removes the PAC, so the very next request goes through.
    if (mode === ProxyMode.LOCAL) {
      console.warn(`Local proxy is not reachable (${error}), rechecking...`)
      await ProxyManager.syncLocalProxy()
      return
    }

    // A custom proxy belongs to the user, there's nothing to fail over to.
    if (mode !== ProxyMode.DEFAULT || !unusableProxyErrors.includes(error)) {
      return
    }

    const {
      currentProxyServer,
      fallbackProxyInUse,
    } = await browser.storage.local.get({
      fallbackProxyInUse: false,
      currentProxyServer: null,
    })

    if (fallbackProxyInUse) {
      await browser.storage.local.set({
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
        await browser.storage.local.set({ badProxies })
      }

      browser.tabs.query({
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
  await browser.storage.local.set({ updateAvailable: true })
  console.warn(`Update available: ${version}`)
}
