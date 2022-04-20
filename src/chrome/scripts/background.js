import {
  handleBeforeRequestPing,
  handleCustomProxiedDomainsChange,
  handleIgnoredHostsChange,
  handleOnAlarm,
  handleProxyError,
  handleStartup,
} from '@/common/scripts/handlers'
import ignore from '@/common/scripts/ignore'
import proxy from '@/common/scripts/proxy'
import registry from '@/common/scripts/registry'
import settings from '@/common/scripts/settings'
import * as storage from '@/common/scripts/storage'
import * as utilities from '@/common/scripts/utilities'

chrome.alarms.onAlarm.addListener(handleOnAlarm)
chrome.runtime.onStartup.addListener(handleStartup)
chrome.proxy.onProxyError.addListener(handleProxyError)
chrome.storage.onChanged.addListener(handleIgnoredHostsChange)
chrome.storage.onChanged.addListener(handleCustomProxiedDomainsChange)

chrome.webNavigation.onBeforeNavigate.addListener(
  handleBeforeRequestPing, {
    urls: ['http://*/*', 'https://*/*'],
    types: ['main_frame'],
  },
)

const handleTabState = async (tabId, changeInfo, { url: tabUrl }) => {
  if (changeInfo && changeInfo.status === chrome.tabs.TabStatus.COMPLETE) {
    const isNotIgnored = !ignore.contains(tabUrl)
    const proxyingEnabled = await proxy.enabled()
    const extensionEnabled = await settings.extensionEnabled()

    if (extensionEnabled && isNotIgnored && utilities.isValidURL(tabUrl)) {
      const urlBlocked = await registry.contains(tabUrl)
      const { url: disseminatorUrl, cooperationRefused } =
        await registry.retrieveInformationDisseminationOrganizerJSON(tabUrl)

      if (proxyingEnabled && urlBlocked) {
        settings.setBlockedIcon(tabId)
        return
      }

      if (disseminatorUrl) {
        settings.setDangerIcon(tabId)
        if (!cooperationRefused) {
          await showCooperationAcceptedWarning(tabUrl)
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
        title: settings.getName(),
        priority: 2,
        message: chrome.i18n.getMessage('cooperationAcceptedMessage', hostname),
        buttons: [
          { title: chrome.i18n.getMessage('muteNotificationsForThis') },
          { title: chrome.i18n.getMessage('readMoreButton') },
        ],
        iconUrl: settings.getDangerIcon(),
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
  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({
      url: chrome.runtime.getURL('installed.html'),
    })
  }

  await settings.enableExtension()
  await settings.enableNotifications()

  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    const synchronized = await registry.sync()

    if (synchronized) {
      await proxy.setProxy()
    }
  }
  await proxy.ping()
}

chrome.runtime.onInstalled.addListener(handleInstalled)

const handleTabCreate = async ({ id }) => {
  const extensionEnabled = await settings.extensionEnabled()

  if (extensionEnabled) {
    settings.setDefaultIcon(id)
  } else {
    settings.setDisableIcon(id)
  }
}

chrome.tabs.onCreated.addListener(handleTabCreate)

/**
 * Fired when one or more items change.
 * @param changes Object describing the change. This contains one property for each key that changed.
 * @param _areaName The name of the storage area ("sync", "local") to which the changes were made.
 */
const handleStorageChanged = async ({ enableExtension, ignoredHosts, useProxy }, _areaName) => {
  if (enableExtension) {
    const newValue = enableExtension.newValue
    const oldValue = enableExtension.oldValue

    if (newValue === true && oldValue === false) {
      await proxy.setProxy()
    }

    if (newValue === false && oldValue === true) {
      await proxy.removeProxy()
    }
  }

  if (useProxy && enableExtension === undefined) {
    const newValue = useProxy.newValue
    const oldValue = useProxy.oldValue

    const extensionEnabled = settings.extensionEnabled()

    if (extensionEnabled) {
      if (newValue === true && oldValue === false) {
        await proxy.setProxy()
      }

      if (newValue === false && oldValue === true) {
        await proxy.removeProxy()
      }
    }
  }
}

chrome.storage.onChanged.addListener(handleStorageChanged)
