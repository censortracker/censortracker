import {
  proxies,
  Database,
  registry,
  sessions,
  settings,
  shortcuts,
  errors,
  asynchrome,
} from './core'

const REQUEST_FILTERS = {
  urls: ['*://*/*'],
  types: ['main_frame'],
}

window.censortracker = {
  proxies,
  Database,
  registry,
  sessions,
  settings,
  shortcuts,
  errors,
  asynchrome,
}

const onBeforeRequest = (details) => {
  const url = details.url

  if (shortcuts.validURL(url)) {
    console.log('Redirecting request to HTTPS...')
    return {
      redirectUrl: shortcuts.enforceHttps(url),
    }
  }
  return null
}

const onBeforeRedirect = async ({ requestId, url }) => {
  const { hostname } = new URL(url)
  const redirectCountKey = 'redirectCount'

  const count = sessions.getRequest(requestId, redirectCountKey, 0)

  if (count) {
    sessions.putRequest(requestId, redirectCountKey, count + 1)
  } else {
    sessions.putRequest(requestId, redirectCountKey, 1)
  }

  if (sessions.areMaxRedirectsReached(count)) {
    if (chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {
      chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest)
    }
    console.warn(`Reached max count of redirects. Adding "${hostname}" to ignore...`)

    const { ignoredSites } = await asynchrome.storage.local.get({ ignoredSites: [] })

    if (!ignoredSites.includes(hostname)) {
      ignoredSites.push(hostname)
      console.warn(`Site ${hostname} add to ignore`)
      await asynchrome.storage.local.set({ ignoredSites })
    }
  }
}

const onErrorOccurred = ({ url, error, tabId }) => {
  const errorText = error.replace('net::', '')
  const urlObject = new URL(url)
  const hostname = urlObject.hostname
  const encodedUrl = window.btoa(url)

  if (errors.isThereProxyConnectionError(errorText)) {
    chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL('proxy_unavailable.html'),
    })
  }

  if (errors.isThereConnectionError(errorText)) {
    console.warn('Possible DPI lock detected: reporting domain...')
    registry.addBlockedByDPI(hostname)
    proxies.setProxy()
    chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL(`unavailable.html?${encodedUrl}`),
    })
  }

  if (errors.isThereCertificateError(errorText) || errors.isThereAvailabilityError(errorText)) {
    console.warn('Certificate validation issue. Adding hostname to ignore...')

    Database.get({ ignoredSites: [] })
      .then(({ ignoredSites }) => {
        if (!ignoredSites.includes(hostname)) {
          ignoredSites.push(hostname)
          Database.set('ignoredSites', ignoredSites)
        }

        if (chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {
          chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest)
        }
        chrome.tabs.update({
          url: url.replace('https:', 'http:'),
        })
      })
  }
}

const onCompleted = (details) => {
  sessions.deleteRequest(details.requestId)
  if (!chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {
    chrome.webRequest.onBeforeRequest.addListener(
      onBeforeRequest,
      REQUEST_FILTERS,
      ['blocking'],
    )
  }
}

const notificationOnButtonClicked = async (notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    const [tab] = await asynchrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    })

    const urlObject = new URL(tab.url)
    const hostname = urlObject.hostname

    const { mutedForever } = await asynchrome.storage.local.get({ mutedForever: [] })

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

const updateTabState = async () => {
  const [tab] = await asynchrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  })

  if (!tab || !shortcuts.validURL(tab.url)) {
    return
  }

  const { enableExtension, ignoredSites } = await asynchrome.storage.local.get({
    enableExtension: true,
    ignoredSites: [],
  })

  if (!enableExtension) {
    setPageIcon(tab.id, settings.getDisabledIcon())
    if (chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {
      chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest)
    }
    return
  }

  const urlObject = new URL(tab.url)
  const currentHostname = shortcuts.cleanHostname(urlObject.hostname)

  if (ignoredSites.includes(currentHostname)) {
    console.warn(`Site ${currentHostname} found in ignore`)
    return
  }

  if (!chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {
    chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, REQUEST_FILTERS, ['blocking'])
  }

  const { domainFound } = await registry.domainsContains(currentHostname)
  const { url, cooperationRefused } = await registry.distributorsContains(currentHostname)

  if (domainFound) {
    setPageIcon(tab.id, settings.getDangerIcon())
    return
  }

  if (url) {
    setPageIcon(tab.id, settings.getDangerIcon())
    if (!cooperationRefused) {
      await showCooperationAcceptedWarning(currentHostname)
    }
    return
  }
  setPageIcon(tab.id, settings.getDefaultIcon())
}

const setPageIcon = (tabId, icon) => {
  chrome.pageAction.setIcon({
    tabId,
    path: icon,
  })
  chrome.pageAction.setTitle({
    title: settings.getTitle(),
    tabId,
  })
}

const showCooperationAcceptedWarning = async (hostname) => {
  if (!hostname) {
    return
  }

  const { notifiedHosts, mutedForever } = await Database.get({
    notifiedHosts: [],
    mutedForever: [],
  })

  if (mutedForever.includes(hostname)) {
    return
  }

  if (!notifiedHosts.includes(hostname)) {
    chrome.notifications.create({
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

    notifiedHosts.push(hostname)

    await asynchrome.storage.local.set({ notifiedHosts })
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
    console.log(`Installing ${settings.getName()}...`)
    const synced = await registry.syncDatabase()

    if (synced) {
      proxies.openPorts()
      settings.enableExtension()
      proxies.setProxy()
    }
  }
})

chrome.runtime.onStartup.addListener(async () => {
  await registry.syncDatabase()
  await updateTabState()
})

chrome.windows.onRemoved.addListener(async (_windowId) => {
  await asynchrome.storage.local.remove('notifiedHosts').catch(console.error)
  console.warn('A list of notified hosts has been cleaned up!')
})

chrome.proxy.onProxyError.addListener((details) => {
  console.error(`Proxy error: ${JSON.stringify(details)}`)
})

chrome.webRequest.onErrorOccurred.addListener(
  onErrorOccurred,
  REQUEST_FILTERS,
)

chrome.webRequest.onBeforeRequest.addListener(
  onBeforeRequest,
  REQUEST_FILTERS,
  ['blocking'],
)

chrome.webRequest.onBeforeRedirect.addListener(onBeforeRedirect, {
  urls: ['*://*/*'],
})

chrome.webRequest.onCompleted.addListener(onCompleted, {
  urls: ['*://*/*'],
})

chrome.notifications.onButtonClicked.addListener(notificationOnButtonClicked)

chrome.tabs.onActivated.addListener(updateTabState)
chrome.tabs.onUpdated.addListener(updateTabState)

setInterval(() => {
  proxies.openPorts()
}, 60 * 1000 * 3)
