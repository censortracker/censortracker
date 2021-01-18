import {
  errors,
  ignore,
  proxy,
  registry,
  settings,
} from './core'
import {
  enforceHttpConnection,
  enforceHttpsConnection,
  extractHostnameFromUrl,
  validateUrl,
} from './core/utilities'

window.censortracker = {
  proxy,
  registry,
  settings,
  errors,
  ignore,
  browser, // TODO: There is no need in this hack
  extractHostnameFromUrl,
}

/**
 * Fires when a request is about to occur. This event is sent before any TCP
 * connection is made and can be used to cancel or redirect requests.
 * @param url Current URL address.
 * @returns {undefined|{redirectUrl: *}} Undefined or redirection to HTTPS§.
 */
const onBeforeRequestListener = ({ url }) => {
  const { hostname } = new URL(url)

  if (ignore.isIgnoredHost(hostname)) {
    console.warn(`Ignoring host: ${url}`)
    return undefined
  }
  proxy.allowProxying()
  return {
    redirectUrl: enforceHttpsConnection(url),
  }
}

chrome.webRequest.onBeforeRequest.addListener(
  onBeforeRequestListener, {
    urls: ['http://*/*'],
    types: ['main_frame'],
  }, ['blocking'],
)

/**
 * Fires when a request could not be processed successfully.
 * @param url Current URL address.
 * @param error The error description.
 * @param tabId The ID of the tab in which the request takes place.
 * @returns {undefined} Undefined.
 */
const onErrorOccurredListener = async ({ url, error, tabId }) => {
  const { hostname } = new URL(url)

  if (ignore.isIgnoredHost(hostname)) {
    return
  }

  if (errors.isThereProxyConnectionError(error)) {
    chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL('proxy_unavailable.html'),
    })
    return
  }

  if (errors.isThereConnectionError(error)) {
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
    await registry.addBlockedByDPI(hostname)
    await proxy.setProxy()
    return
  }

  await ignore.addHostToIgnore(hostname)
  chrome.tabs.remove(tabId)
  chrome.tabs.create({
    url: enforceHttpConnection(url),
  })
}

chrome.webRequest.onErrorOccurred.addListener(
  onErrorOccurredListener,
  {
    urls: ['http://*/*', 'https://*/*'],
    types: ['main_frame'],
  },
)

const notificationOnButtonClicked = async (notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    const [tab] = await browser.tabs.query({
      active: true,
      lastFocusedWindow: true,
    })

    const { hostname } = new URL(tab.url)
    const { mutedForever } =
      await browser.storage.local.get({ mutedForever: [] })

    if (!mutedForever.find((item) => item === hostname)) {
      mutedForever.push(hostname)

      try {
        await browser.storage.local.set({ mutedForever })
        console.warn(`We won't notify you about ${hostname} anymore`)
      } catch (error) {
        console.error(error)
      }
    }
  }
}

const updateTabState = async () => {
  const [tab] = await browser.tabs.query({
    active: true,
    lastFocusedWindow: true,
  })

  if (!tab || !validateUrl(tab.url)) {
    return
  }

  const { enableExtension, useNotificationsChecked } =
    await browser.storage.local.get({
      enableExtension: true,
      useNotificationsChecked: true,
    })

  if (!enableExtension) {
    settings.setDisableIcon(tab.id)
    return
  }

  const { hostname } = new URL(tab.url)
  const currentHostname = extractHostnameFromUrl(hostname)

  if (ignore.isIgnoredHost(currentHostname)) {
    return
  }

  const { domainFound } = await registry.domainsContains(currentHostname)
  const { url: distributorUrl, cooperationRefused } =
    await registry.distributorsContains(currentHostname)

  if (domainFound) {
    settings.setDangerIcon(tab.id)
    return
  }

  if (distributorUrl) {
    settings.setDangerIcon(tab.id)
    if (useNotificationsChecked && !cooperationRefused) {
      await showCooperationAcceptedWarning(currentHostname)
    }
  }
}

const showCooperationAcceptedWarning = async (hostname) => {
  const { notifiedHosts, mutedForever } =
    await browser.storage.local.get({
      notifiedHosts: [],
      mutedForever: [],
    })

  if (mutedForever.includes(hostname)) {
    return
  }

  if (!notifiedHosts.includes(hostname)) {
    await browser.notifications.create({
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
      await browser.storage.local.set({ notifiedHosts })
    } catch (error) {
      console.error(error)
    }
  }
}

const handleInstalled = async ({ reason }) => {
  if (reason === 'install') {
    browser.tabs.create({
      url: browser.runtime.getURL('installed.html'),
    })

    const synchronized = await registry.syncDatabase()

    if (synchronized) {
      settings.enableExtension()
      await proxy.setProxy()
    }
  }
}

browser.runtime.onInstalled.addListener(handleInstalled)

const onTabCreated = async ({ id }) => {
  const { enableExtension } =
    await browser.storage.local.get({
      enableExtension: true,
    })

  if (enableExtension) {
    settings.setDefaultIcon(id)
  } else {
    settings.setDisableIcon(id)
  }
}

chrome.tabs.onCreated.addListener(onTabCreated)

browser.runtime.onStartup.addListener(async () => {
  await registry.syncDatabase()
  await updateTabState()
})

chrome.windows.onRemoved.addListener(async (_windowId) => {
  await browser.storage.local.remove('notifiedHosts').catch(console.error)
  console.warn('A list of notified hosts has been cleaned up!')
})

chrome.tabs.onActivated.addListener(updateTabState)
chrome.tabs.onUpdated.addListener(updateTabState)
chrome.notifications.onButtonClicked.addListener(notificationOnButtonClicked)

const handleProxyRequest = async ({ url }) => {
  const { hostname } = new URL(url)

  proxy.allowProxying()

  const isBlocked = await registry.isHostBlocked(hostname)

  if (isBlocked) {
    console.log(`Proxying: ${hostname}`)
    return {
      type: 'https',
      host: 'proxy-ssl.roskomsvoboda.org',
      port: 33333,
    }
  }
  console.warn('Avoiding proxy')
  return { type: 'direct' }
}

browser.proxy.onRequest.addListener(handleProxyRequest, { urls: ['http://*/*', 'https://*/*'], types: ['main_frame'] })

// The mechanism for controlling handlers from popup.js
window.censortracker.chromeListeners = {
  has: () => {
    const hasOnErrorOccurredListener =
      chrome.webRequest.onErrorOccurred.hasListener(onErrorOccurredListener)
    const hasOnBeforeRequestListener =
      chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequestListener)

    return hasOnBeforeRequestListener && hasOnErrorOccurredListener
  },
  remove: () => {
    chrome.webRequest.onErrorOccurred.removeListener(onErrorOccurredListener)
    chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequestListener)
    console.warn('CensorTracker: listeners removed')
  },
  add: () => {
    chrome.webRequest.onErrorOccurred.addListener(onErrorOccurredListener, {
      urls: ['http://*/*', 'https://*/*'],
      types: ['main_frame'],
    })
    chrome.webRequest.onBeforeRequest.addListener(
      onBeforeRequestListener, {
        urls: ['http://*/*'],
        types: ['main_frame'],
      },
      ['blocking'],
    )
    console.warn('CensorTracker: listeners added')
  },
}
