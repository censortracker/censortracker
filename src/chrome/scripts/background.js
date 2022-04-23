import {
  handleBeforeRequestPing,
  handleCustomProxiedDomainsChange,
  handleIgnoredHostsChange,
  handleOnAlarm,
  handleProxyError,
  handleStartup,
  handleStorageChanged,
} from '@/shared/scripts/handlers'
import Ignore from '@/shared/scripts/ignore'
import ProxyManager from '@/shared/scripts/proxy'
import Registry from '@/shared/scripts/registry'
import Settings from '@/shared/scripts/settings'
import * as storage from '@/shared/scripts/storage'
import * as utilities from '@/shared/scripts/utilities'

chrome.alarms.onAlarm.addListener(handleOnAlarm)
chrome.runtime.onStartup.addListener(handleStartup)
chrome.proxy.onProxyError.addListener(handleProxyError)
chrome.storage.onChanged.addListener(handleStorageChanged)
chrome.storage.onChanged.addListener(handleIgnoredHostsChange)
chrome.storage.onChanged.addListener(handleCustomProxiedDomainsChange)

chrome.webNavigation.onBeforeNavigate.addListener(
  handleBeforeRequestPing, {
    urls: ['http://*/*', 'https://*/*'],
    types: ['main_frame'],
  },
)

const handleTabState = async (tabId, changeInfo, tab) => {
  if (changeInfo && changeInfo.status === chrome.tabs.TabStatus.COMPLETE) {
    const isIgnored = await Ignore.contains(tab.url)
    const proxyingEnabled = await ProxyManager.enabled()
    const extensionEnabled = await Settings.extensionEnabled()

    if (extensionEnabled && !isIgnored && utilities.isValidURL(tab.url)) {
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
          await showCooperationAcceptedWarning(tab.url)
        }
      }
    }
  }
}

chrome.tabs.onActivated.addListener(handleTabState)
chrome.tabs.onUpdated.addListener(handleTabState)

const showCooperationAcceptedWarning = async (url) => {
  const hostname = utilities.extractHostnameFromUrl(url)
  const { notifiedHosts, showNotifications } = await storage.get({
    notifiedHosts: [],
    showNotifications: true,
  })

  if (showNotifications) {
    if (!notifiedHosts.includes(hostname)) {
      await chrome.notifications.create({
        type: 'basic',
        title: Settings.getName(),
        priority: 2,
        message: chrome.i18n.getMessage('cooperationAcceptedMessage', hostname),
        buttons: [
          { title: chrome.i18n.getMessage('muteNotificationsForThis') },
          { title: chrome.i18n.getMessage('readMoreButton') },
        ],
        iconUrl: Settings.getDangerIcon(),
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

const handleInstalled = async ({ reason }) => {
  console.group('onInstall')

  await Settings.enableExtension()
  await Settings.enableNotifications()

  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    await chrome.tabs.create({ url: 'installed.html' })

    const synchronized = await Registry.sync()

    if (synchronized) {
      await ProxyManager.ping()
      await ProxyManager.setProxy()
    } else {
      console.warn('Synchronization failed')
    }
  }
  console.groupEnd()
}

chrome.runtime.onInstalled.addListener(handleInstalled)

const handleTabCreate = async ({ id }) => {
  const extensionEnabled = await Settings.extensionEnabled()

  if (extensionEnabled) {
    Settings.setDefaultIcon(id)
  } else {
    Settings.setDisableIcon(id)
  }
}

chrome.tabs.onCreated.addListener(handleTabCreate)
