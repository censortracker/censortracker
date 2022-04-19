import {
  ignore,
  proxy,
  registry,
  settings,
} from '@/common/js'
import {
  handleCustomProxiedDomainsChange,
  handleIgnoredHostsChange,
  handleProxyError,
  handlerBeforeRequestPing,
  handleStartup,
} from '@/common/js/handlers'
import * as storage from '@/common/js/storage'
import * as utilities from '@/common/js/utilities'

chrome.runtime.onStartup.addListener(handleStartup)
chrome.proxy.onProxyError.addListener(handleProxyError)
chrome.storage.onChanged.addListener(handleIgnoredHostsChange)
chrome.storage.onChanged.addListener(handleCustomProxiedDomainsChange)

chrome.webNavigation.onBeforeNavigate.addListener(
  handlerBeforeRequestPing, {
    urls: ['http://*/*', 'https://*/*'],
    types: ['main_frame'],
  },
)

const handleTabState = async (tabId, changeInfo, tab) => {
  if (changeInfo && changeInfo.status === chrome.tabs.TabStatus.COMPLETE) {
    const extensionEnabled = await settings.extensionEnabled()
    const proxyingEnabled = await proxy.enabled()

    if (extensionEnabled && utilities.isValidURL(tab.url)) {
      if (ignore.contains(tab.url)) {
        return
      }

      const urlBlocked = await registry.contains(tab.url)
      const { url: distributorUrl, cooperationRefused } =
        await registry.retrieveInformationDisseminationOrganizerJSON(tab.url)

      if (proxyingEnabled && urlBlocked) {
        settings.setBlockedIcon(tabId)
        return
      }

      if (distributorUrl) {
        settings.setDangerIcon(tabId)
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
  const { notifiedHosts, mutedForever, showNotifications } =
    await storage.get({
      notifiedHosts: [],
      mutedForever: [],
      showNotifications: true,
    })

  if (showNotifications && !mutedForever.includes(hostname)) {
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
  chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
    chrome.declarativeContent.onPageChanged.addRules([{
      conditions: [
        new chrome.declarativeContent.PageStateMatcher({
          pageUrl: {
            schemes: ['http', 'https'],
          },
        }),
      ],
      actions: [new chrome.declarativeContent.ShowPageAction()],
    }])
  })

  const reasonsForSync = [
    chrome.runtime.OnInstalledReason.INSTALL,
  ]

  if (reasonsForSync.includes(reason)) {
    chrome.tabs.create({
      url: chrome.runtime.getURL('installed.html'),
    })
  }

  await settings.enableExtension()
  await settings.enableNotifications()
  await settings.disableDPIDetection()

  if (reasonsForSync.includes(reason)) {
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

  if (extensionEnabled === false) {
    settings.setDisableIcon(id)
  } else if (extensionEnabled === true) {
    settings.setDefaultIcon(id)
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
