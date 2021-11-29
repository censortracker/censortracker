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
  storage,
} from '@/common/js'

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

  console.warn(`Request redirected to HTTPS: ${hostname}`)

  browser.extension.isAllowedIncognitoAccess()
    .then(async (allowed) => {
      if (!allowed) {
        await proxy.requestIncognitoAccess()
      }
    })

  if (ignore.contains(hostname)) {
    return undefined
  }

  proxy.ping()
  return {
    redirectUrl: enforceHttpsConnection(url),
  }
}

/**
 * Fires when a request could not be processed successfully.
 * @param url Current URL address.
 * @param error The error description.
 * @param tabId The ID of the tab in which the request takes place.
 * @returns {undefined} Undefined.
 */
const handleErrorOccurred = async ({ error, url, tabId }) => {
  const encodedUrl = window.btoa(url)
  const foundInRegistry = await registry.contains(url)
  const proxyingEnabled = await proxy.proxyingEnabled()
  const { proxyError, connectionError } = errors.determineError(error)
  const allowedIncognitoAccess = await browser.extension.isAllowedIncognitoAccess()

  if (ignore.contains(url)) {
    return
  }

  if (proxyError) {
    browser.tabs.update(tabId, {
      url: browser.runtime.getURL(
        `proxy_unavailable.html?originUrl=${encodedUrl}`,
      ),
    })
    return
  }

  if (connectionError) {
    if (!allowedIncognitoAccess) {
      browser.tabs.update(tabId, {
        url: browser.runtime.getURL(
          `incognito_required_tab.html?originUrl=${encodedUrl}`,
        ),
      })
      return
    }

    if (!proxyingEnabled) {
      browser.tabs.update(tabId, {
        url: browser.runtime.getURL(
          `proxy_disabled.html?originUrl=${encodedUrl}`,
        ),
      })
      return
    }

    if (!foundInRegistry) {
      await registry.add(url)
      await proxy.setProxy()

      browser.tabs.update(tabId, {
        url: browser.runtime.getURL(`unavailable.html?originUrl=${encodedUrl}`),
      })
      return
    }
  }

  await ignore.add(url, { temporary: foundInRegistry })
  await browser.tabs.update(tabId, {
    url: enforceHttpConnection(url),
  })
}

/**
 * Check if proxy is ready to use.
 * Set proxy if proxying enabled and incognito access granted.
 * @returns {Promise<boolean>}
 */
const checkProxyReadiness = async () => {
  const proxyingEnabled = await proxy.proxyingEnabled()
  const controlledByThisExtension = await proxy.controlledByThisExtension()
  const allowedIncognitoAccess = await browser.extension.isAllowedIncognitoAccess()

  if (proxyingEnabled && allowedIncognitoAccess) {
    if (!controlledByThisExtension) {
      await proxy.setProxy()
      await proxy.grantIncognitoAccess()
    }
    console.log(`Proxy is already controlled by ${settings.getName()}`)
    return true
  }
  console.warn('Proxy is not ready to use. Check if private browsing permissions granted.')
  return false
}

const handleTabState = async (tabId, changeInfo, { url: tabUrl }) => {
  const extensionEnabled = await settings.extensionEnabled()

  if (changeInfo && changeInfo.status === browser.tabs.TabStatus.COMPLETE) {
    if (extensionEnabled && isValidURL(tabUrl) && !ignore.contains(tabUrl)) {
      await checkProxyReadiness()

      const urlBlocked = await registry.contains(tabUrl)
      const { url: distributorUrl, cooperationRefused } =
        await registry.distributorsContains(tabUrl)

      if (urlBlocked) {
        settings.setBlockedIcon(tabId)
        return
      }

      if (distributorUrl) {
        settings.setDangerIcon(tabId)
        if (!cooperationRefused) {
          await showCooperationAcceptedWarning(tabUrl)
        }
      }
    }
  }
}

browser.tabs.onActivated.addListener(handleTabState)
browser.tabs.onUpdated.addListener(handleTabState)

const handleTabCreate = async ({ id }) => {
  const extensionEnabled = await settings.extensionEnabled()

  if (extensionEnabled) {
    await checkProxyReadiness()
  } else {
    settings.setDisableIcon(id)
  }
}

browser.tabs.onCreated.addListener(handleTabCreate)

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
        message: browser.i18n.getMessage('cooperationAcceptedMessage', hostname),
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
  const reasonsForSync = [
    browser.runtime.OnInstalledReason.UPDATE,
    browser.runtime.OnInstalledReason.INSTALL,
  ]

  if (reason === browser.runtime.OnInstalledReason.INSTALL) {
    browser.tabs.create({
      url: browser.runtime.getURL('installed.html'),
    })
  }

  await ignore.setDefaultIgnoredHosts()

  if (reasonsForSync.includes(reason)) {
    const synchronized = await registry.sync()

    if (synchronized) {
      await settings.enableExtension()
      const allowedIncognitoAccess =
        await browser.extension.isAllowedIncognitoAccess()

      if (allowedIncognitoAccess) {
        console.warn('onInstall: incognito access allowed, setting proxy...')
        await proxy.setProxy()
      } else {
        await proxy.requestIncognitoAccess()
      }
    }
  }
  proxy.ping()
}

browser.runtime.onInstalled.addListener(handleInstalled)

const handleUninstalled = async (_info) => {
  await storage.clear()
}

browser.management.onUninstalled.addListener(handleUninstalled)
browser.runtime.onStartup.addListener(async () => {
  await registry.sync()
})

/**
 * Fired when one or more items change.
 * @param changes Object describing the change. This contains one property for each key that changed.
 * @param _areaName The name of the storage area ("sync", "local") to which the changes were made.
 */
const handleStorageChanged = async ({ enableExtension, ignoredHosts, useProxy, useDPIDetection }, _areaName) => {
  if (ignoredHosts && ignoredHosts.newValue) {
    ignore.save()
  }

  if (useDPIDetection) {
    if (useDPIDetection.newValue === true) {
      browser.webRequest.onErrorOccurred.addListener(
        handleErrorOccurred, getRequestFilter({ http: true, https: true }),
      )
      browser.webRequest.onBeforeRequest.addListener(
        handleBeforeRequest, getRequestFilter({ http: true, https: false }),
        ['blocking'],
      )
      console.warn('WEBREQUEST LISTENERS ENABLED')
    }

    if (useDPIDetection.newValue === false) {
      browser.webRequest.onErrorOccurred.removeListener(handleErrorOccurred)
      browser.webRequest.onBeforeRequest.removeListener(handleBeforeRequest)
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

browser.storage.onChanged.addListener(handleStorageChanged)

browser.proxy.onError.addListener(async (error) => {
  console.log(error)
})
