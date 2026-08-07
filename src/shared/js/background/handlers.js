import browser from './browser-api'
import { TaskType } from './constants'
import { hostFromUri } from './geoip'
import Ignore from './ignore'
import ProxyManager from './proxy'
import Registry from './registry'
import * as server from './server'
import Settings from './settings'
import Task from './task'
import {
  checkForUpdate,
  restoreUpdateBadge,
  UPDATE_CHECK_INTERVAL_MINUTES,
} from './update'
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
  } else if (name === TaskType.FETCH_PROXY_SOURCES) {
    await ProxyManager.fetchProxySources()
  } else if (name === TaskType.CHECK_FOR_UPDATE) {
    await checkForUpdate()
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

// The warm-up ping only needs to keep the proxy connection fresh, so firing
// it on every single page load is wasted traffic: one ping per minute is
// plenty (the PING alarm still covers long-idle periods). The timestamp lives
// in memory, so after a service-worker restart the first navigation simply
// pings again — which is exactly what we want.
const PING_THROTTLE_MS = 60 * 1000
let lastPingAt = 0

export const handleBeforeRequest = async (_details) => {
  const now = Date.now()

  if (now - lastPingAt < PING_THROTTLE_MS) {
    return
  }
  lastPingAt = now

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
    { name: TaskType.PING, minutes: 10 },
    { name: TaskType.SET_PROXY, minutes: 15 },
    { name: TaskType.REMOVE_BAD_PROXIES, minutes: 20 },
    { name: TaskType.CHECK_FOR_UPDATE, minutes: UPDATE_CHECK_INTERVAL_MINUTES },
  ])
  await ProxyManager.applyProxySourcesSchedule()

  // A badge does not survive a browser restart, but the stored flag does.
  await restoreUpdateBadge()
  await checkForUpdate()
  console.groupEnd()
}

export const handleIgnoredHostsChange = async (
  { ignoredHosts = {} } = {},
  _areaName,
) => {
  if ('newValue' in ignoredHosts) {
    ProxyManager.isEnabled().then((enabled) => {
      if (enabled) {
        ProxyManager.setProxy().then((proxySet) => {
        })
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

      browser.tabs.query({}).then((tabs) => {
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
    await ProxyManager.enableProxy()
    await ProxyManager.requestIncognitoAccess()
    await ProxyManager.setProxy()
    await ProxyManager.ping()

    // Schedule tasks to run in the background.
    await Task.schedule([
      { name: TaskType.SET_PROXY, minutes: 15 },
      { name: TaskType.REMOVE_BAD_PROXIES, minutes: 5 },
      {
        name: TaskType.CHECK_FOR_UPDATE,
        minutes: UPDATE_CHECK_INTERVAL_MINUTES,
      },
    ])
    await ProxyManager.applyProxySourcesSchedule()

    // The build that just landed is by definition current: clear any badge
    // left over from the version it replaced, then re-check.
    await browser.storage.local.set({ updateAvailable: false })
    await checkForUpdate()
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

/**
 * Proxy failures the extension knows how to recover from. Chromium-based
 * browsers (Chrome, Opera, Edge, Yandex…) report `net::`-prefixed names,
 * Firefox reports `NS_ERROR_*` ones.
 */
const RECOVERABLE_PROXY_ERRORS = [
  // Firefox
  'NS_ERROR_UNKNOWN_PROXY_HOST',
  'NS_ERROR_PROXY_CONNECTION_REFUSED',
  // Chromium
  'ERR_PROXY_CONNECTION_FAILED',
  'ERR_TUNNEL_CONNECTION_FAILED',
  'ERR_SOCKS_CONNECTION_FAILED',
]

// An unreachable proxy makes the browser report a proxy error for EVERY
// request that tries to use it — with "proxy all traffic" on, that is the
// entire browsing session. Recovery (re-sync, re-probe, re-apply the PAC) is
// therefore rate-limited: without this, each failing request queued another
// full recovery round and the extension spent its time thrashing instead of
// reconnecting.
const PROXY_RECOVERY_COOLDOWN_MS = 30 * 1000
let lastProxyRecoveryAt = 0

/**
 * Normalizes what the various proxy-error events hand us into a bare error
 * name. Chromium's `proxy.onProxyError` passes `{ error, details, fatal }`,
 * Firefox's `webRequest.onErrorOccurred` passes `{ error }`, and Firefox's
 * `proxy.onError` passes a plain `Error` — reading `.error` off that one
 * yields `undefined` and used to throw inside the listener.
 * @param {Object|Error|string} event
 * @returns {string}
 */
const extractProxyError = (event) => {
  if (!event) {
    return ''
  }

  const raw = typeof event === 'string'
    ? event
    : (event.error || event.message || '')

  return String(raw).replace('net::', '').trim()
}

export const handleProxyError = async (event) => {
  const error = extractProxyError(event)

  if (!RECOVERABLE_PROXY_ERRORS.includes(error)) {
    return
  }

  const now = Date.now()

  if (now - lastProxyRecoveryAt < PROXY_RECOVERY_COOLDOWN_MS) {
    return
  }
  lastProxyRecoveryAt = now

  // Which proxies is the PAC actually routing through right now? When the user
  // is on their own proxies that's the chain — and it used to be ignored
  // entirely, so a dead custom proxy left the browser unable to load anything
  // with the extension doing nothing about it.
  const chain = await ProxyManager.getChainProxyConfigs()

  if (chain.length > 0) {
    console.error(`Proxy connection failed (${error}), re-checking the chain...`)
    await ProxyManager.recoverProxyChain()
    return
  }

  const {
    currentProxyServer,
    proxyServerURI,
    fallbackProxyInUse,
  } = await browser.storage.local.get({
    fallbackProxyInUse: false,
    currentProxyServer: null,
    proxyServerURI: '',
  })

  if (fallbackProxyInUse) {
    await browser.storage.local.set({
      proxyIsAlive: false,
      fallbackProxyError: error,
    })
    console.warn('Fallback proxy is intermittent, interrupting auto fetch...')
    return
  }

  // `currentProxyServer` is only stored by a successful config sync, so it can
  // be missing while a proxy fetched earlier is still in the PAC. Fall back to
  // the host of the configured URI instead of blaming (and logging) `null`.
  const failedProxy = currentProxyServer || hostFromUri(proxyServerURI)

  console.error(
    `Proxy connection failed (${error}) on ` +
    `${failedProxy || 'an unconfigured proxy'}, requesting a new server...`,
  )
  await browser.storage.local.set({ proxyIsAlive: false })

  if (failedProxy) {
    const badProxies = await ProxyManager.getBadProxies()

    if (!badProxies.includes(failedProxy)) {
      badProxies.push(failedProxy)
      await browser.storage.local.set({ badProxies })
    }
  }

  // Re-sync even when no server could be blamed: an empty/stale proxy config
  // is exactly the state a fresh fetch fixes.
  await server.synchronize({
    syncIgnore: false,
    syncRegistry: false,
    syncProxy: true,
  })
  await ProxyManager.setProxy()
  await ProxyManager.ping()
}

export const handleOnUpdateAvailable = async ({ version }) => {
  await browser.storage.local.set({ updateAvailable: true })
  console.log(`Update available: ${version}`)
}
