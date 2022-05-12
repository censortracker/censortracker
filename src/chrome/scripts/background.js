import {
  handleBeforeRequestPing,
  handleCustomProxiedDomainsChange,
  handleIgnoredHostsChange,
  handleInformationDisseminationOrganizer,
  handleOnAlarm,
  handleProxyError,
  handleStartup,
  handleStorageChanged,
} from '@/shared/scripts/handlers'
import Ignore from '@/shared/scripts/ignore'
import ProxyManager from '@/shared/scripts/proxy'
import Registry from '@/shared/scripts/registry'
import Settings from '@/shared/scripts/settings'
import Task from '@/shared/scripts/task'
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
          await handleInformationDisseminationOrganizer(tab.url)
        }
      }
    }
  }
}

chrome.tabs.onActivated.addListener(handleTabState)
chrome.tabs.onUpdated.addListener(handleTabState)

const handleInstalled = async ({ reason }) => {
  console.group('onInstall')

  await Settings.enableExtension()
  await Settings.enableNotifications()

  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    await chrome.tabs.create({ url: 'installed.html' })

    await Task.schedule([
      { name: 'ignore-fetch', minutes: 15 },
      { name: 'registry-sync', minutes: 30 },
      { name: 'proxy-setProxy', minutes: 10 },
    ])

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
