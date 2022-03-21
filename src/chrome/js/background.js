import {
  enforceHttpConnection,
  errors,
  extractHostnameFromUrl,
  getRequestFilter,
  ignore,
  isValidURL,
  proxy,
  registry,
  settings,
  storage,
} from '@/common/js'

import {
  handleBeforeRequestRedirectToHttps,
  handleCustomProxiedDomainsChange,
  handleIgnoredHostsChange,
  handleProxyError,
  handlerBeforeRequestPing,
  handleStartup,
} from '../../common/js/handlers'
import { asynchrome } from './core'

chrome.runtime.onStartup.addListener(handleStartup)
chrome.proxy.onProxyError.addListener(handleProxyError)
chrome.storage.onChanged.addListener(handleIgnoredHostsChange)
chrome.storage.onChanged.addListener(handleCustomProxiedDomainsChange)

chrome.webRequest.onBeforeRequest.addListener(
  handlerBeforeRequestPing, getRequestFilter({ http: true, https: true }),
  ['blocking'],
)

/**
 * Fires when a request could not be processed successfully.
 * @param url Current URL address.
 * @param error The error description.
 * @param tabId The ID of the tab in which the request takes place.
 * @returns {undefined} Undefined.
 */
const handleErrorOccurred = async ({ url, error, tabId }) => {
  const encodedUrl = window.btoa(url)
  const foundInRegistry = await registry.contains(url)
  const proxyingEnabled = await proxy.enabled()
  const { proxyError, connectionError, interruptedError } = errors.determineError(error)

  if (interruptedError || ignore.contains(url)) {
    return
  }

  if (proxyError) {
    chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL(`proxy_unavailable.html?originUrl=${encodedUrl}`),
    })
    return
  }

  if (connectionError) {
    if (!proxyingEnabled) {
      chrome.tabs.update(tabId, {
        url: chrome.runtime.getURL(`proxy_disabled.html?originUrl=${encodedUrl}`),
      })
      return
    }

    if (!foundInRegistry) {
      await registry.add(url)
      await proxy.setProxy()

      chrome.tabs.update(tabId, {
        url: chrome.runtime.getURL(`unavailable.html?originUrl=${encodedUrl}`),
      })
      return
    }
  }

  await ignore.add(url, { temporary: foundInRegistry })
  chrome.tabs.remove(tabId)
  chrome.tabs.create({
    url: enforceHttpConnection(url),
  })
}

const handleNotificationButtonClicked = async (notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    const [tab] = await asynchrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    })

    const hostname = extractHostnameFromUrl(tab.url)
    const { mutedForever } = await storage.get({ mutedForever: [] })

    if (!mutedForever.find((item) => item === hostname)) {
      mutedForever.push(hostname)

      try {
        await storage.set({ mutedForever })
        console.warn(`We won't notify you about ${hostname} anymore`)
      } catch (error) {
        console.error(error)
      }
    }
  }
}

chrome.notifications.onButtonClicked.addListener(handleNotificationButtonClicked)

const handleTabState = async (tabId, changeInfo, tab) => {
  if (changeInfo && changeInfo.status === chrome.tabs.TabStatus.COMPLETE) {
    const extensionEnabled = await settings.extensionEnabled()
    const proxyingEnabled = await proxy.enabled()

    if (extensionEnabled && isValidURL(tab.url)) {
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
  const hostname = extractHostnameFromUrl(url)
  const { notifiedHosts, mutedForever, showNotifications } =
    await storage.get({
      notifiedHosts: [],
      mutedForever: [],
      showNotifications: true,
    })

  if (showNotifications && !mutedForever.includes(hostname)) {
    if (!notifiedHosts.includes(hostname)) {
      await asynchrome.notifications.create({
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

  await settings.enableNotifications()
  await settings.disableDPIDetection()

  if (reasonsForSync.includes(reason)) {
    const synchronized = await registry.sync()

    if (synchronized) {
      await proxy.setProxy()
      await settings.enableExtension()
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
const handleStorageChanged = async ({ enableExtension, ignoredHosts, useProxy, useDPIDetection }, _areaName) => {
  if (useDPIDetection) {
    const webRequestListenersActivate = chrome.webRequest.onErrorOccurred.hasListener(handleErrorOccurred) &&
      chrome.webRequest.onBeforeRequest.hasListener(handleBeforeRequestRedirectToHttps)

    if (useDPIDetection.newValue === true && !webRequestListenersActivate) {
      chrome.webRequest.onErrorOccurred.addListener(
        handleErrorOccurred, getRequestFilter({ http: true, https: true }),
      )
      chrome.webRequest.onBeforeRequest.addListener(
        handleBeforeRequestRedirectToHttps, getRequestFilter({ http: true, https: false }),
        ['blocking'],
      )
      console.warn('WEBREQUEST LISTENERS ENABLED')
    }

    if (useDPIDetection.newValue === false && webRequestListenersActivate) {
      chrome.webRequest.onErrorOccurred.removeListener(handleErrorOccurred)
      chrome.webRequest.onBeforeRequest.removeListener(handleBeforeRequestRedirectToHttps)
      console.warn('WEBREQUEST LISTENERS REMOVED')
    }
  }

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

// Debug namespaces.
window.censortracker = {
  proxy,
  registry,
  settings,
  errors,
  ignore,
  asynchrome,
  storage,
  extractHostnameFromUrl,
}
