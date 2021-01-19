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
const handleBeforeRequest = ({ url }) => {
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

browser.webRequest.onBeforeRequest.addListener(
  handleBeforeRequest, {
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
const handleErrorOccurred = async ({ url, error, tabId }) => {
  const { hostname } = new URL(url)

  if (ignore.isIgnoredHost(hostname)) {
    return
  }

  if (errors.isThereProxyConnectionError(error)) {
    browser.tabs.update(tabId, {
      url: browser.runtime.getURL('proxy_unavailable.html'),
    })
    return
  }

  if (errors.isThereConnectionError(error)) {
    const isProxyControlledByOtherExtensions = await proxy.controlledByOtherExtensions()
    const isProxyControlledByThisExtension = await proxy.controlledByThisExtension()

    if (!isProxyControlledByOtherExtensions && !isProxyControlledByThisExtension) {
      browser.tabs.update(tabId, {
        url: browser.runtime.getURL(`proxy_disabled.html?${window.btoa(url)}`),
      })
      return
    }

    browser.tabs.update(tabId, {
      url: browser.runtime.getURL(`unavailable.html?${window.btoa(url)}`),
    })
    await registry.addBlockedByDPI(hostname)
    await proxy.setProxy()
    return
  }

  await ignore.addHostToIgnore(hostname)
  browser.tabs.remove(tabId)
  browser.tabs.create({
    url: enforceHttpConnection(url),
  })
}

// browser.webRequest.onErrorOccurred.addListener(
//   handleErrorOccurred,
//   {
//     urls: ['http://*/*', 'https://*/*'],
//     types: ['main_frame'],
//   },
// )

const handleTabState = async () => {
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

const handleTabCreate = async ({ id }) => {
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

browser.tabs.onCreated.addListener(handleTabCreate)

browser.runtime.onStartup.addListener(async () => {
  await registry.syncDatabase()
  await handleTabState()
})

browser.tabs.onActivated.addListener(handleTabState)
browser.tabs.onUpdated.addListener(handleTabState)

const handleProxyRequest = async ({ url }) => {
  const { hostname } = new URL(url)

  proxy.allowProxying()

  // const isBlocked = await registry.isHostBlocked(hostname)
  const isBlocked = true

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

browser.proxy.onRequest.addListener(handleProxyRequest, { urls: ['<all_urls>']})

// The mechanism for controlling handlers from popup.js
window.censortracker.browserListeners = {
  // TODO: Pretty bad idea to use that name (fix it).
  has: () => {
    const hasOnErrorOccurredListener =
      browser.webRequest.onErrorOccurred.hasListener(handleErrorOccurred)
    const hasOnBeforeRequestListener =
      browser.webRequest.onBeforeRequest.hasListener(handleBeforeRequest)

    return hasOnBeforeRequestListener && hasOnErrorOccurredListener
  },
  remove: () => {
    browser.webRequest.onErrorOccurred.removeListener(handleErrorOccurred)
    browser.webRequest.onBeforeRequest.removeListener(handleBeforeRequest)
    console.warn('CensorTracker: listeners removed')
  },
  add: () => {
    browser.webRequest.onErrorOccurred.addListener(handleErrorOccurred, {
      urls: ['http://*/*', 'https://*/*'],
      types: ['main_frame'],
    })
    browser.webRequest.onBeforeRequest.addListener(
      handleBeforeRequest, {
        urls: ['http://*/*'],
        types: ['main_frame'],
      },
      ['blocking'],
    )
    console.warn('CensorTracker: listeners added')
  },
}
