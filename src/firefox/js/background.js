import {
  errors,
  ignore,
  proxy,
  registry,
  settings,
  storage,
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
  storage,
  extractHostnameFromUrl,
}

/**
 * Fires when a request is about to occur. This event is sent before any TCP
 * connection is made and can be used to cancel or redirect requests.
 * @param url Current URL address.
 * @returns {undefined|{redirectUrl: *}} Undefined or redirection to HTTPS.
 */
const handleBeforeRequest = ({ url }) => {
  const hostname = extractHostnameFromUrl(url)

  if (ignore.contains(hostname)) {
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
 * Fired when a web request is about to be made, to give the extension an opportunity to proxy it.
 * @param url Current URL address.
 * @returns {Promise<{port: number, host: string, type: string}|{type: string}>}
 */
const handleProxyRequest = async ({ url }) => {
  const { useProxy } = await storage.get({ useProxy: true })
  const { domainFound } = await registry.domainsContains(url)

  if (useProxy && domainFound) {
    proxy.allowProxying()
    return proxy.getProxyInfo()
  }
  return proxy.getDirectProxyInfo()
}

browser.proxy.onRequest.addListener(
  handleProxyRequest, {
    urls: ['http://*/*', 'https://*/*'],
    types: ['main_frame'],
  },
)

/**
 * Fires when a request could not be processed successfully.
 * @param url Current URL address.
 * @param error The error description.
 * @param tabId The ID of the tab in which the request takes place.
 * @returns {undefined} Undefined.
 */
const handleErrorOccurred = async ({ url, error, tabId }) => {
  console.error(`ERROR CODE IS: ${error}`)
  const hostname = extractHostnameFromUrl(url)
  const encodedUrl = window.btoa(url)

  const { useProxy } = await storage.get({ useProxy: true })

  if (ignore.contains(hostname)) {
    return
  }

  if (errors.isThereProxyConnectionError(error)) {
    browser.tabs.update(tabId, {
      url: browser.runtime.getURL(`proxy_unavailable.html?${encodedUrl}`),
    })
    return
  }

  if (errors.isThereConnectionError(error)) {
    if (!useProxy) {
      browser.tabs.update(tabId, {
        url: browser.runtime.getURL(`proxy_disabled.html?${encodedUrl}`),
      })
    }

    browser.tabs.update(tabId, {
      url: browser.runtime.getURL(`unavailable.html?${encodedUrl}`),
    })
    await registry.addBlockedByDPI(hostname)
    return
  }

  await ignore.add(hostname)
  browser.tabs.remove(tabId)
  browser.tabs.create({
    url: enforceHttpConnection(url),
  })
}

browser.webRequest.onErrorOccurred.addListener(
  handleErrorOccurred,
  {
    urls: ['http://*/*', 'https://*/*'],
    types: ['main_frame'],
  },
)

const handleTabState = async () => {
  const { enableExtension } = await storage.get({ enableExtension: true })
  const [{ url: currentUrl, id: tabId }] = await browser.tabs.query({
    active: true, lastFocusedWindow: true,
  })

  if (ignore.contains(currentUrl)) {
    return
  }

  if (enableExtension && validateUrl(currentUrl)) {
    const { domainFound } = await registry.domainsContains(currentUrl)
    const { url: distributorUrl, cooperationRefused } =
      await registry.distributorsContains(currentUrl)

    if (domainFound) {
      settings.setDangerIcon(tabId)
      return
    }

    if (distributorUrl) {
      settings.setDangerIcon(tabId)
      if (!cooperationRefused) {
        await showCooperationAcceptedWarning(currentUrl)
      }
    }
  } else {
    settings.setDisableIcon(tabId)
  }
}

browser.tabs.onActivated.addListener(handleTabState)
browser.tabs.onUpdated.addListener(handleTabState)

const showCooperationAcceptedWarning = async (currentUrl) => {
  const hostname = extractHostnameFromUrl(currentUrl)
  const { notifiedHosts, showNotifications } = await storage.get({
    notifiedHosts: new Set(),
    showNotifications: true,
  })

  if (showNotifications) {
    if (!notifiedHosts.has(hostname)) {
      console.log(`Showing notification for ${hostname}`)
      await browser.notifications.create(hostname, {
        type: 'basic',
        title: settings.getName(),
        iconUrl: settings.getDangerIcon(),
        message: `${hostname} может передавать информацию третьим лицам.`,
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

const handleWindowRemoved = async (_windowId) => {
  await storage.remove('notifiedHosts')
  console.warn('A list of notified hosts has been cleaned up!')
}

browser.windows.onRemoved.addListener(handleWindowRemoved)

/**
 * Fired when the extension is first installed, when the extension is
 * updated to a new version, and when the browser is updated to a new version.
 * @param reason The reason that the runtime.onInstalled event is being dispatched.
 * @returns {Promise<void>}
 */
const handleInstalled = async ({ reason }) => {
  if (reason === 'install') {
    const synchronized = await registry.syncDatabase()

    if (synchronized) {
      settings.enableExtension()
      await proxy.enableProxy()
    }
  }
}

browser.runtime.onInstalled.addListener(handleInstalled)

const handleUninstalled = async (_info) => {
  await storage.clear()
}

browser.management.onUninstalled.addListener(handleUninstalled)

const handleTabCreate = async ({ id }) => {
  const { enableExtension } = await storage.get({ enableExtension: true })

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

window.censortracker.events = {
  hasListeners: () => {
    return (
      browser.webRequest.onErrorOccurred.hasListener(handleErrorOccurred) &&
      browser.webRequest.onBeforeRequest.hasListener(handleBeforeRequest)
    )
  },
  removeListeners: () => {
    browser.webRequest.onErrorOccurred.removeListener(handleErrorOccurred)
    browser.webRequest.onBeforeRequest.removeListener(handleBeforeRequest)
    console.warn('CensorTracker: listeners are removed')
  },
  addListeners: () => {
    browser.webRequest.onErrorOccurred.addListener(
      handleErrorOccurred, {
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
    console.warn('CensorTracker: listeners are added')
  },
}
