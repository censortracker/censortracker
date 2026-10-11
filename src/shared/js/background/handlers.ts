import browser from './browser-api'
import { TaskType } from './constants'
import { CONSENT_VERSION, getDataConsent, hasDataConsent, isConsentError } from './data-consent'
import { activateNotices, openNotices, pendingNotices } from './extension-notices'
import { getMessage, initializeLanguage } from './i18n'
import Ignore from './ignore'
import ProxyManager from './proxy'
import { stopProxyChecks } from './proxy-check'
import { refreshNextSubscription, SUBSCRIPTION_ALARM } from './proxy-importer'
import type { ProxyErrorDetails } from './proxy-recovery'
import { recoverProxy, RECOVERY_ALARM, retryFailedProxies } from './proxy-recovery'
import { withProxyLock } from './proxy-route'
import Registry from './registry'
import * as server from './server'
import { MIRRORS_ALARM, refreshServiceMirrors, scheduleServiceMirrors } from './service-mirrors'
import Settings from './settings'
import type { StorageChanges } from './storage'
import Task from './task'
import * as utilities from './utilities'

let lastNavigationPing = -Infinity

export const showDisseminatorWarning = async (url: string) => {
  const hostname = utilities.extractDomainFromUrl(url)!
  const {
    notifiedHosts,
    showNotifications,
  } = await browser.storage.local.get({
    notifiedHosts: [],
    showNotifications: true,
  })

  if (showNotifications && !notifiedHosts.includes(hostname)) {
    await initializeLanguage()
    await browser.notifications.create(hostname, {
      type: 'basic',
      title: Settings.getName(),
      iconUrl: Settings.getDangerIcon(),
      message: getMessage('cooperationAcceptedMessage', hostname),
    })

    try {
      notifiedHosts.push(hostname)
      await browser.storage.local.set({ notifiedHosts })
    } catch (error) {
      console.error(error)
    }
  }
}

export const handleOnAlarm = async ({ name }: { name: string }) => {
  if (!await hasDataConsent()) {
    return
  }
  console.log(`Task received: ${name}`)

  if (name === 'checkLocalProxy') {
    await ProxyManager.syncLocalProxy()
  } else if (name === MIRRORS_ALARM) {
    await refreshServiceMirrors()
  } else if (name === RECOVERY_ALARM) {
    try {
      await retryFailedProxies()
    } catch (error) {
      console.warn('Proxy recovery check failed')
    }
  } else if (name === SUBSCRIPTION_ALARM) {
    try {
      await refreshNextSubscription()
    } catch (error) {
      console.warn('Proxy subscription download failed')
    }
  } else if (name === TaskType.PING) {
    await ProxyManager.ping()
  } else if (name === TaskType.REMOVE_BAD_PROXIES) {
    await ProxyManager.removeBadProxies()
  } else if (name === TaskType.SET_PROXY) {
    const proxyingEnabled = await ProxyManager.isEnabled()

    if (proxyingEnabled && await Settings.extensionEnabled()) {
      await server.synchronize()
      await ProxyManager.setProxy()
    }
  } else {
    console.warn(`Unknown task: ${name}`)
  }
}

export const handleBeforeRequest = async (_details?: unknown) => {
  if (await hasDataConsent() && await Settings.extensionEnabled() &&
      await ProxyManager.isEnabled()) {
    const now = performance.now()

    if (now - lastNavigationPing >= 30000) {
      lastNavigationPing = now
      await ProxyManager.ping()
    }
    await ProxyManager.requestIncognitoAccess()
  }
}

export const handleStartup = async () => {
  if (!await hasDataConsent()) {
    await pauseDataTransmission()
    return
  }
  console.groupCollapsed('onStartup')

  await scheduleLocalProxyCheck()
  await ProxyManager.syncLocalProxy()
  await scheduleServiceMirrors()
  const proxyingEnabled = await ProxyManager.isEnabled()

  if (proxyingEnabled && await Settings.extensionEnabled()) {
    await ProxyManager.setProxy()
  }

  await Task.schedule([
    { name: TaskType.PING, minutes: 60 },
    { name: TaskType.SET_PROXY, minutes: 60 },
    { name: TaskType.REMOVE_BAD_PROXIES, minutes: 60 },
  ])
  console.groupEnd()
}

export const scheduleLocalProxyCheck = () => withProxyLock(async () => {
  const { useLocalProxy } = await browser.storage.local.get('useLocalProxy')

  if (useLocalProxy && await hasDataConsent()) {
    await browser.alarms.create('checkLocalProxy', { periodInMinutes: 1 })
  } else {
    await browser.alarms.clear('checkLocalProxy')
  }
})

export const handleIgnoredHostsChange = async (
  { ignoredHosts }: StorageChanges = {},
  areaName?: string,
) => {
  if ((areaName && areaName !== 'local') || !ignoredHosts) {
    return
  }
  if (await hasDataConsent() && await Settings.extensionEnabled() &&
      await ProxyManager.isEnabled()) {
    await ProxyManager.setProxy()
  }
}

export const handleCustomProxiedDomainsChange = async (
  { customProxiedDomains }: StorageChanges = {},
  areaName?: string,
) => {
  if ((areaName && areaName !== 'local') || !customProxiedDomains) {
    return
  }
  if (await hasDataConsent() && await Settings.extensionEnabled() &&
      await ProxyManager.isEnabled()) {
    await ProxyManager.setProxy()
  }
}

/**
 * Fired when one or more items change.
 * @param changes Object describing the change. This contains one property for each key that changed.
 * @param areaName The storage area in which the changes were made.
 */
export const handleStorageChanged = async (
  { enableExtension, useProxy }: StorageChanges = {},
  areaName?: string,
) => {
  if ((areaName && areaName !== 'local') || (!enableExtension && !useProxy)) {
    return
  }
  // Read current choices inside the queue; old events must not undo new choices.
  await withProxyLock(async () => {
    if (await hasDataConsent() && await Settings.extensionEnabled() &&
      await ProxyManager.isEnabled()) {
      await ProxyManager.setProxyInBackground()
    } else {
      await ProxyManager.removeProxyInBackground()
    }
  })

  if (enableExtension) {
    const tabs = await browser.tabs.query({})
    const enabled = await Settings.extensionEnabled()

    for (const { id } of tabs) {
      if (enabled) {
        Settings.setDefaultIcon(id)
      } else {
        Settings.setDisableIcon(id)
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
export const pauseDataTransmission = async () => {
  // Clear CT's setting immediately; an active request can hold the route lock.
  await ProxyManager.removeProxyInBackground()
  await stopProxyChecks()
  await withProxyLock(() => ProxyManager.removeProxyInBackground())
}

export const openDataConsent = async () => {
  const url = browser.runtime.getURL('consent.html')
  const tabs = await browser.tabs.query({})
  const existing = tabs.find((tab) => tab.url === url)

  if (existing) {
    await browser.tabs.update(existing.id!, { active: true })
    await browser.windows.update(existing.windowId!, { focused: true })
  } else {
    await browser.tabs.create({ url, active: true })
  }
}

let consentWrites: Promise<unknown> = Promise.resolve()
let consentWork = Promise.resolve()

export const setDataConsent = (accepted: boolean) => {
  if (typeof accepted !== 'boolean') {
    throw new TypeError('Invalid consent choice')
  }
  // Serialize writes, but let revocation cancel an earlier network operation.
  const write = consentWrites.then(async () => {
    const previous = await getDataConsent()

    if (previous?.accepted === accepted) {
      return false
    }
    if (accepted) {
      const state = await browser.storage.local.get([
        'consentInstallPending', 'enableExtension', 'useProxy', 'useRegistry', 'showNotifications',
      ])

      if (state.consentInstallPending) {
        await browser.storage.local.set({
          enableExtension: state.enableExtension ?? true,
          useProxy: state.useProxy ?? true,
          useRegistry: state.useRegistry ?? true,
          showNotifications: state.showNotifications ?? true,
        })
        await browser.storage.local.remove('consentInstallPending')
      }
    }
    await browser.storage.local.set({
      dataConsent: { version: CONSENT_VERSION, accepted },
    })
    return true
  })

  consentWrites = write.catch(() => {})
  return write.then((changed) => {
    if (!changed) {
      return accepted ? undefined : consentWork
    }
    const work = async () => {
      if (!await hasDataConsent()) {
        await pauseDataTransmission()
        return
      }
      await handleStartup()
      if (await hasDataConsent() && await Settings.extensionEnabled()) {
        await server.synchronize()
        await ProxyManager.setProxy()
      }
    }

    if (!accepted) {
      // Do not wait for the serialized resume operation to release the proxy.
      ProxyManager.removeProxyInBackground().catch(() => {})
    }
    consentWork = consentWork.catch(() => {}).then(work).catch((error) => {
      if (!isConsentError(error)) {
        if (accepted) {
          console.error('Could not resume data transmission', error)
          return
        }
        throw error
      }
    })
    return accepted ? undefined : consentWork
  })
}

export const handleInstalled = async ({ reason }: { reason: string }) => {
  const installed = reason === browser.runtime.OnInstalledReason.INSTALL
  const updated = reason === browser.runtime.OnInstalledReason.UPDATE

  if (!installed && !updated) {
    return
  }
  const newNotices = await activateNotices(reason)

  if (installed) {
    await browser.storage.local.set({ consentInstallPending: true })
  }
  if (!await hasDataConsent()) {
    await pauseDataTransmission()
  }
  const { consentPromptVersion } = await browser.storage.local.get('consentPromptVersion')

  if (newNotices) {
    await openNotices()
  } else if (!await getDataConsent() &&
    consentPromptVersion !== CONSENT_VERSION &&
    (await pendingNotices()).length === 0) {
    await openDataConsent()
    await browser.storage.local.set({ consentPromptVersion: CONSENT_VERSION })
  }
  if (await hasDataConsent()) {
    await handleStartup()
  }
}

export const handleTabState = async (
  tabId: number,
  { status = 'loading' }: { status?: string } = {},
  { url, incognito }: { url?: string; incognito?: boolean } = {},
) => {
  if (url && status === browser.tabs.TabStatus.LOADING) {
    Settings.setDefaultIcon(tabId)
    Settings.extensionEnabled().then((enabled) => {
      if (enabled) {
        Ignore.contains(url).then(async (isIgnored) => {
          Registry.retrieveDisseminator(url).then(
            async ({ url: disseminatorUrl, cooperationRefused }) => {
              if (disseminatorUrl) {
                if (!cooperationRefused) {
                  Settings.setDangerIcon(tabId)
                  // Notifications save the domain; require a known non-private tab.
                  if (incognito === false) {
                    await showDisseminatorWarning(url)
                  }
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

export const handleTabCreate = async (tab: { id?: number }) => {
  Settings.extensionEnabled()
    .then((enabled) => {
      if (enabled) {
        Settings.setDefaultIcon(tab.id)
      } else {
        Settings.setDisableIcon(tab.id)
      }
    })
}

export const handleProxyError = async (details: ProxyErrorDetails) => {
  try {
    if (await ProxyManager.usingLocalProxy()) {
      await ProxyManager.syncLocalProxy()
    } else {
      await recoverProxy(details)
    }
  } catch {
    console.warn('Proxy recovery failed; selected proxies were kept')
  }
}

export const handleOnUpdateAvailable = async (
  { version }: { version: string },
) => {
  await browser.storage.local.set({ updateAvailable: true })
  console.info(`Update available: ${version}`)
}
