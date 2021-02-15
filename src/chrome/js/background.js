import {
  enforceHttpConnection,
  enforceHttpsConnection,
  extractHostnameFromUrl,
  getRequestFilter,
  validateUrl,
} from '../../common/js/utilities'
import {
  asynchrome,
  errors,
  ignore,
  proxy,
  registry,
  settings,
} from './core'

window.censortracker = {
  proxy,
  registry,
  settings,
  errors,
  ignore,
  asynchrome,
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
  const hostname = extractHostnameFromUrl(url)
  const { proxyError, connectionError } = errors.determineError(error)

  if (ignore.contains(hostname)) {
    return
  }

  if (proxyError) {
    chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL('proxy_unavailable.html'),
    })
    return
  }

  if (connectionError) {
    const isProxyControlledByOtherExtensions = await proxy.controlledByOtherExtensions()
    const isProxyControlledByThisExtension = await proxy.controlledByThisExtension()

    if (!isProxyControlledByOtherExtensions && !isProxyControlledByThisExtension) {
      chrome.tabs.update(tabId, {
        url: chrome.runtime.getURL(`proxy_disabled.html?${window.btoa(url)}`),
      })
      return
    }

    chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL(`unavailable.html?${window.btoa(url)}`),
    })
    await registry.add(hostname)
    await proxy.setProxy()
    return
  }

  await ignore.add(hostname)
  chrome.tabs.remove(tabId)
  chrome.tabs.create({
    url: enforceHttpConnection(url),
  })
}

chrome.webRequest.onErrorOccurred.addListener(
  handleErrorOccurred,
  getRequestFilter({ http: true, https: true }),
)

const notificationButtonClickedHandler = async (notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    const [tab] = await asynchrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    })

    const hostname = extractHostnameFromUrl(tab.url)
    const { mutedForever } =
      await asynchrome.storage.local.get({ mutedForever: [] })

    if (!mutedForever.find((item) => item === hostname)) {
      mutedForever.push(hostname)

      try {
        await asynchrome.storage.local.set({ mutedForever })
        console.warn(`We won't notify you about ${hostname} anymore`)
      } catch (error) {
        console.error(error)
      }
    }
  }
}

const handleTabState = async () => {
  const [tab] = await asynchrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  })

  if (!tab || !validateUrl(tab.url)) {
    return
  }

  const { enableExtension, showNotifications } =
    await asynchrome.storage.local.get({
      enableExtension: true,
      showNotifications: true,
    })

  if (!enableExtension) {
    settings.setDisableIcon(tab.id)
    return
  }

  const hostname = extractHostnameFromUrl(tab.url)
  const currentHostname = extractHostnameFromUrl(hostname)

  if (ignore.contains(currentHostname)) {
    return
  }

  const { domainFound } = await registry.domainsContains(currentHostname)
  const { url: distributorUrl, cooperationRefused } =
    await registry.distributorsContains(currentHostname)

  if (domainFound) {
    settings.setBlockedIcon(tab.id)
    return
  }

  if (distributorUrl) {
    settings.setDangerIcon(tab.id)
    if (showNotifications && !cooperationRefused) {
      await showCooperationAcceptedWarning(currentHostname)
    }
  }
}

const showCooperationAcceptedWarning = async (hostname) => {
  const { notifiedHosts, mutedForever } =
    await asynchrome.storage.local.get({
      notifiedHosts: [],
      mutedForever: [],
    })

  if (mutedForever.includes(hostname)) {
    return
  }

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
      await asynchrome.storage.local.set({ notifiedHosts })
    } catch (error) {
      console.error(error)
    }
  }
}

chrome.runtime.onInstalled.addListener(async ({ reason }) => {
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

  if (reason === 'install') {
    chrome.tabs.create({
      url: chrome.runtime.getURL('installed.html'),
    })

    const synchronized = await registry.sync()

    if (synchronized) {
      settings.enableExtension()
      await proxy.setProxy()
    }
  }
})

const handleTabCreate = async ({ id }) => {
  const { enableExtension } =
    await asynchrome.storage.local.get({
      enableExtension: true,
    })

  if (enableExtension) {
    settings.setDefaultIcon(id)
  } else {
    settings.setDisableIcon(id)
  }
}

chrome.tabs.onCreated.addListener(handleTabCreate)

chrome.runtime.onStartup.addListener(async () => {
  await registry.sync()
  await handleTabState()
})

chrome.windows.onRemoved.addListener(async (_windowId) => {
  await asynchrome.storage.local.remove('notifiedHosts')
})

chrome.proxy.onProxyError.addListener((details) => {
  console.error(`Proxy error: ${JSON.stringify(details)}`)
})

chrome.tabs.onActivated.addListener(handleTabState)
chrome.tabs.onUpdated.addListener(handleTabState)
chrome.notifications.onButtonClicked.addListener(notificationButtonClickedHandler)

// The mechanism for controlling handlers from popup.js
window.censortracker.events = {
  has: () => {
    return (
      chrome.webRequest.onErrorOccurred.hasListener(handleErrorOccurred) &&
      chrome.webRequest.onBeforeRequest.hasListener(handleBeforeRequest)
    )
  },
  remove: () => {
    chrome.webRequest.onErrorOccurred.removeListener(handleErrorOccurred)
    chrome.webRequest.onBeforeRequest.removeListener(handleBeforeRequest)
    console.warn('CensorTracker: listeners removed')
  },
  add: () => {
    chrome.webRequest.onErrorOccurred.addListener(
      handleErrorOccurred,
      getRequestFilter({ http: true, https: true }),
    )
    chrome.webRequest.onBeforeRequest.addListener(
      handleBeforeRequest,
      getRequestFilter({ http: true, https: false }),
      ['blocking'],
    )
    console.warn('CensorTracker: listeners added')
  },
}
