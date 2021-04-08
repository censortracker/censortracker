import {
  enforceHttpConnection,
  enforceHttpsConnection,
  errors,
  extractHostnameFromUrl,
  getRequestFilter,
  ignore,
  proxy,
  registry,
  settings,
  storage,
  validateUrl,
} from './core'

window.censortracker = {
  proxy,
  registry,
  settings,
  storage,
  errors,
  ignore,
  extractHostnameFromUrl,
}

/*
The typical sequence of events is like this (see https://mzl.la/3mrPiCm for more details):

            |-----------▷ onBeforeRequest
            |                   |
            |                   ▽
            |           onBeforeSendHeaders ◁-------|
            |                   |                   |
            |                   ▽                   |
            |              onSendHeaders            |
            |                   |                   |
            |                   ▽                   |
            |            onHeadersReceived          |
            |                   |                   |
            |                   ▽                   |
  onBeforeRedirected ◁-- onResponseStarted --▷ onAuthRequired
                                |
                                ▽
                            onCompleted
 */

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
  getRequestFilter({ http: true, https: false, types: ['main_frame'] }),
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

  if (useProxy && domainFound) {
    proxy.allowProxying()
    return proxy.getProxyInfo()
  }
  return proxy.getDirectProxyInfo()
}

browser.proxy.onRequest.addListener(
  handleProxyRequest,
  getRequestFilter({ http: false, https: true }),
)

/**
 * Fires when a request could not be processed successfully.
 * @param url Target of the request.
 * @param error The error description. Set to -1 if the request isn't related to a tab.
 * @param type The type of resource being requested: for example, "image", "script", "stylesheet".
 * @param tabId The ID of the tab in which the request takes place.
 * @returns {undefined} Undefined.
 */
const handleErrorOccurred = async ({ error, url, type, tabId }) => {
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
  }

  await ignore.add(hostname)
  browser.tabs.update(tabId, {
    url: enforceHttpConnection(url),
  })
}

browser.webRequest.onErrorOccurred.addListener(
  handleErrorOccurred,
  getRequestFilter({ http: true, https: true, types: ['main_frame'] }),
)

const handleTabState = async (tabId, changeInfo, tab) => {
  if (changeInfo && 'status' in changeInfo && changeInfo.status === 'complete') {
    const { enableExtension } = await storage.get({ enableExtension: true })

    if (enableExtension && validateUrl(tab.url)) {
      if (ignore.contains(tab.url)) {
        return
      }

      const { domainFound } = await registry.domainsContains(tab.url)
      const { url: distributorUrl, cooperationRefused } =
        await registry.distributorsContains(tab.url)

      if (domainFound) {
        settings.setBlockedIcon(tabId)
        return
      }

      if (distributorUrl) {
        settings.setDangerIcon(tabId)
        if (!cooperationRefused) {
          await showCooperationAcceptedWarning(tab.url)
        }
      }
    } else {
      settings.setDisableIcon(tabId)
    }
  }
}

browser.tabs.onActivated.addListener(handleTabState)
browser.tabs.onUpdated.addListener(handleTabState)

const showCooperationAcceptedWarning = async (url) => {
  const hostname = extractHostnameFromUrl(url)
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
const handleStorageChanged = ({ enableExtension: { newValue: extensionEnabled } = {}, ignoredHosts = undefined }, areaName) => {
  // See: https://git.io/Jtw5D
  const listenersActivated = (
    browser.webRequest.onErrorOccurred.hasListener(handleErrorOccurred) &&
    browser.webRequest.onBeforeRequest.hasListener(handleBeforeRequest)
  )

  // See src/common/ui/ignore_editor.js
  if (ignoredHosts !== undefined) {
    ignore.save()
  }

  if (extensionEnabled === true) {
    if (!listenersActivated) {
      browser.webRequest.onErrorOccurred.addListener(
        handleErrorOccurred,
        getRequestFilter({ http: true, https: true, types: ['main_frame'] }),
      )
      browser.webRequest.onBeforeRequest.addListener(
        handleBeforeRequest,
        getRequestFilter({ http: true, https: false, types: ['main_frame'] }),
        ['blocking'],
      )
      console.warn('Web request listeners enabled')
    }
  }

  if (extensionEnabled === false) {
    browser.webRequest.onErrorOccurred.removeListener(handleErrorOccurred)
    browser.webRequest.onBeforeRequest.removeListener(handleBeforeRequest)
    console.warn('Web request listeners disabled')
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
