import {
  enforceHttpConnection,
  enforceHttpsConnection,
  errors,
  extractHostnameFromUrl,
  getRequestFilter,
  ignore,
  isValidURL,
  proxy,
  registry,
  settings,
  startsWithHttpHttps,
  storage,
} from '@/common/js'

import { asynchrome } from './core'

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

/**
 * Fires when a request is about to occur. This event is sent before any TCP
 * connection is made and can be used to cancel or redirect requests.
 * @param url Current URL address.
 * @returns {undefined|{redirectUrl: *}} Undefined or redirection to HTTPS§.
 */
const handleBeforeRequest = ({ url }) => {
  const hostname = extractHostnameFromUrl(url)

  if (ignore.contains(hostname)) {
    return undefined
  }
  proxy.allowProxying()
  return {
    redirectUrl: enforceHttpsConnection(url),
  }
}

chrome.webRequest.onBeforeRequest.addListener(
  handleBeforeRequest,
  getRequestFilter({ http: true, https: false }),
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
  const { proxyError, connectionError, interruptedError } = errors.determineError(error)

  if (interruptedError || ignore.contains(url) || !startsWithHttpHttps(url)) {
    return
  }

  if (proxyError) {
    chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL(`proxy_unavailable.html?originUrl=${encodedUrl}`),
    })
    return
  }

  if (connectionError) {
    const isProxyControlledByOtherExtensions = await proxy.controlledByOtherExtensions()
    const isProxyControlledByThisExtension = await proxy.controlledByThisExtension()

    if (!isProxyControlledByOtherExtensions && !isProxyControlledByThisExtension) {
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

chrome.webRequest.onErrorOccurred.addListener(
  handleErrorOccurred,
  getRequestFilter({ http: true, https: true }),
)

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

    if (extensionEnabled && isValidURL(tab.url)) {
      if (ignore.contains(tab.url)) {
        return
      }

      const urlBlocked = await registry.contains(tab.url)
      const { url: distributorUrl, cooperationRefused } =
        await registry.distributorsContains(tab.url)

      if (urlBlocked) {
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
        message: `${hostname} может передавать информацию третьим лицам.`,
        buttons: [
          { title: '\u2715 Не показывать для этого сайта' },
          { title: '\u2192 Подробнее' },
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
    chrome.runtime.OnInstalledReason.UPDATE,
  ]

  if (reasonsForSync.includes(reason)) {
    const synchronized = await registry.sync()

    if (synchronized) {
      await proxy.setProxy()
      await settings.enableExtension()
    }
  }

  if (reason === chrome.runtime.OnInstalledReason.INSTALL) {
    chrome.tabs.create({
      url: chrome.runtime.getURL('installed.html'),
    })
  }
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

chrome.windows.onRemoved.addListener(async (_windowId) => {
  await storage.remove(['notifiedHosts'])
})

chrome.proxy.onProxyError.addListener((details) => {
  console.error(`Proxy error: ${JSON.stringify(details)}`)
})

const webRequestListeners = {
  activated: () => {
    return (
      chrome.webRequest.onErrorOccurred.hasListener(handleErrorOccurred) &&
      chrome.webRequest.onBeforeRequest.hasListener(handleBeforeRequest)
    )
  },
  deactivate: () => {
    chrome.webRequest.onErrorOccurred.removeListener(handleErrorOccurred)
    chrome.webRequest.onBeforeRequest.removeListener(handleBeforeRequest)
    console.warn('Web request listeners disabled')
  },
  activate: () => {
    chrome.webRequest.onErrorOccurred.addListener(
      handleErrorOccurred,
      getRequestFilter({ http: true, https: true }),
    )
    chrome.webRequest.onBeforeRequest.addListener(
      handleBeforeRequest,
      getRequestFilter({ http: true, https: false }),
      ['blocking'],
    )
    console.warn('Web request listeners enabled')
  },
}

/**
 * Fired when one or more items change.
 * @param changes Object describing the change. This contains one property for each key that changed.
 * @param _areaName The name of the storage area ("sync", "local") to which the changes were made.
 */
const handleStorageChanged = async (changes, _areaName) => {
  const { enableExtension, ignoredHosts, useProxy } = changes

  if (ignoredHosts && ignoredHosts.newValue) {
    ignore.save()
  }

  if (enableExtension) {
    const newValue = enableExtension.newValue
    const oldValue = enableExtension.oldValue

    if (newValue === true && oldValue === false) {
      await proxy.setProxy()

      if (!webRequestListeners.activated()) {
        webRequestListeners.activate()
      }
    }

    if (newValue === false && oldValue === true) {
      await proxy.removeProxy()
      if (webRequestListeners.activated()) {
        webRequestListeners.deactivate()
      }
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

window.censortracker.webRequestListeners = webRequestListeners
