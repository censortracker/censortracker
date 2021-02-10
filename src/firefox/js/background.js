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
  getRequestFilter,
  validateUrl,
} from './core/utilities'

window.censortracker = {
  proxy,
  registry,
  settings,
  storage,
  errors,
  ignore,
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
    return undefined
  }
  return {
    redirectUrl: enforceHttpsConnection(url),
  }
}

browser.webRequest.onBeforeRequest.addListener(
  handleBeforeRequest,
  getRequestFilter({ http: true, https: false }),
  ['blocking'],
)

/**
 * Fired when a web request is about to be made, to give the extension an opportunity to proxy it.
 * @param url Current URL address.
 * @returns {Promise<{port: number, host: string, type: string}|{type: string}>}
 */
const handleProxyRequest = async ({ url }) => {
  const { useProxy } = await storage.get({ useProxy: true })
  const { domainFound } = await registry.domainsContains(url)

  if (ignore.contains(url)) {
    return proxy.getDirectProxyInfo()
  }

  if (useProxy && domainFound) {
    proxy.allowProxying()
    return proxy.getProxyInfo()
  }
  return proxy.getDirectProxyInfo()
}

browser.proxy.onRequest.addListener(
  handleProxyRequest,
  getRequestFilter({ http: true, https: true }),
)

/**
 * Fires when a request could not be processed successfully.
 * @param url Current URL address.
 * @param error The error description.
 * @param tabId The ID of the tab in which the request takes place.
 * @returns {undefined} Undefined.
 */
const handleErrorOccurred = async ({ error, url, tabId }) => {
  const encodedUrl = window.btoa(url)
  const hostname = extractHostnameFromUrl(url)

  const { useProxy } = await storage.get({ useProxy: true })
  const { proxyError, connectionError } = errors.determineError(error)

  if (proxyError) {
    browser.tabs.update(tabId, {
      url: browser.runtime.getURL(`proxy_unavailable.html?${encodedUrl}`),
    })
    return
  }

  if (connectionError) {
    await registry.add(hostname)

    if (!useProxy) {
      browser.tabs.update(tabId, {
        url: browser.runtime.getURL(`proxy_disabled.html?${encodedUrl}`),
      })
      return
    }

    browser.tabs.update(tabId, {
      url: browser.runtime.getURL(`unavailable.html?${encodedUrl}`),
    })
    return
  }

  await ignore.add(hostname)
  browser.tabs.update(tabId, {
    url: enforceHttpConnection(url),
  })
}

browser.webRequest.onErrorOccurred.addListener(
  handleErrorOccurred,
  getRequestFilter({ http: true, https: true }),
)

const handleTabState = async () => {
  const { enableExtension } = await storage.get({ enableExtension: true })
  const [{ url, id }] = await browser.tabs.query({
    active: true,
    lastFocusedWindow: true,
  })

  if (enableExtension && validateUrl(url)) {
    const { domainFound } = await registry.domainsContains(url)

    if (domainFound) {
      settings.setDangerIcon(id)
      return
    }

    const { url: distributorUrl, cooperationRefused } =
      await registry.distributorsContains(url)

    if (distributorUrl) {
      settings.setDangerIcon(id)
      if (!cooperationRefused) {
        await showCooperationAcceptedWarning(url)
      }
    }
  } else {
    settings.setDisableIcon(id)
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
  await storage.remove(['notifiedHosts'])
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
    const synchronized = await registry.sync()

    if (synchronized) {
      await settings.enableExtension()
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
  await registry.sync()
  await handleTabState()
})

/**
 * Fired when one or more items change.
 * @param changes Object describing the change. This contains one property for each key that changed.
 * @param areaName The name of the storage area ("sync", "local") to which the changes were made.
 */
const handleStorageChanged = ({ enableExtension: { newValue: extensionEnabled } = {} }, areaName) => {
  // See: https://git.io/Jtw5D

  const webRequestHasListeners = (
    browser.webRequest.onErrorOccurred.hasListener(handleErrorOccurred) &&
    browser.webRequest.onBeforeRequest.hasListener(handleBeforeRequest)
  )

  if (typeof extensionEnabled === 'boolean') {
    if (extensionEnabled === true) {
      if (!webRequestHasListeners) {
        browser.webRequest.onErrorOccurred.addListener(
          handleErrorOccurred,
          getRequestFilter({ http: true, https: true }),
        )
        browser.webRequest.onBeforeRequest.addListener(
          handleBeforeRequest,
          getRequestFilter({ http: true, https: false }),
          ['blocking'],
        )
        console.warn('Web request listeners enabled')
      }
    } else {
      browser.webRequest.onErrorOccurred.removeListener(handleErrorOccurred)
      browser.webRequest.onBeforeRequest.removeListener(handleBeforeRequest)
      console.warn('Web request listeners disabled')
    }
  }
}

browser.storage.onChanged.addListener(handleStorageChanged)

window.censortracker.debugging = async () => {
  const { domains } = await storage.get({ domains: [] })
  const excluded = ['rutracker.org', 'lostfilm.tv', 'rezka.ag']

  await storage.set({
    domains: domains.filter((domain) => !excluded.includes(domain)),
  })
}
