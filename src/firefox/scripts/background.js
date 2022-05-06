import {
  handleBeforeRequestPing,
  handleCustomProxiedDomainsChange,
  handleIgnoredHostsChange,
  handleProxyError,
  handleStartup,
  handleStorageChanged,
} from '@/shared/scripts/handlers'
import Ignore from '@/shared/scripts/ignore'
import ProxyManager from '@/shared/scripts/proxy'
import Registry from '@/shared/scripts/registry'
import Settings from '@/shared/scripts/settings'
import * as storage from '@/shared/scripts/storage'
import Task from '@/shared/scripts/task'
import * as utilities from '@/shared/scripts/utilities'

browser.proxy.onError.addListener(handleProxyError)
browser.runtime.onStartup.addListener(handleStartup)
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
          await showCooperationAcceptedWarning(tabUrl)
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

  await Settings.enableExtension()
  await Settings.enableNotifications()

  if (reason === browser.runtime.OnInstalledReason.INSTALL) {
    await browser.tabs.create({ url: 'installed.html' })

    await Task.schedule([
      { name: 'ignore-fetch', minutes: 10 },
      { name: 'registry-sync', minutes: 30 },
      { name: 'proxy-setProxy', minutes: 10 },
    ])

    const synchronized = await Registry.sync()

    if (synchronized) {
      const allowedIncognitoAccess =
        await browser.extension.isAllowedIncognitoAccess()

      if (allowedIncognitoAccess) {
        console.warn('Incognito access allowed, setting proxy...')
        await ProxyManager.ping()
        await ProxyManager.setProxy()
      } else {
        await ProxyManager.requestIncognitoAccess()
      }
    } else {
      console.warn('Synchronization failed')
    }
  }
  console.groupEnd()
}

browser.runtime.onInstalled.addListener(handleInstalled)

// // Debug namespaces.
window.censortracker = {
  ProxyManager,
  Registry,
  Settings,
  storage,
  Ignore,
}
