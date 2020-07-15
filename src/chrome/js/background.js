import {
  proxies,
  Database,
  registry,
  sessions,
  settings,
  shortcuts,
  errors,
} from './core'

import {
  chromeStorageLocalRemove,
  chromeStorageLocalGet,
  chromeStorageLocalSet,
  chromeTabsQuery,
} from './promises'

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
}

const onBeforeRequest = async (details) => {
  const url = details.url
  const urlObject = new URL(url)
  const currentHostname = shortcuts.cleanHostname(urlObject.hostname)

  const { enableExtension, ignoredSites } = await chromeStorageLocalGet({
    enableExtension: true,
    ignoredSites: [],
  })

  if (!enableExtension) {
    return url
  }

  if (ignoredSites.includes(currentHostname)) {
    console.warn(`Site ${currentHostname} found in ignore`)
    return url
  }

  if (shortcuts.validURL(url)) {
    console.log('Redirecting request to HTTPS...')
    return {
      redirectUrl: shortcuts.enforceHttps(url),
    }
  }
  return null
}

const onBeforeRedirect = async (details) => {
  const requestId = details.requestId
  const urlObject = new URL(details.url)
  const hostname = urlObject.hostname
  const redirectCountKey = 'redirectCount'

  const { ignoredSites } = await chromeStorageLocalGet({ ignoredSites: [] })

  const count = sessions.getRequest(requestId, redirectCountKey, 0)

  if (count) {
    sessions.putRequest(requestId, redirectCountKey, count + 1)
  } else {
    sessions.putRequest(requestId, redirectCountKey, 1)
  }

  if (sessions.areMaxRedirectsReached(count)) {
    console.warn(`Reached max count of redirects. Adding "${hostname}" to ignore...`)

    if (!ignoredSites.includes(hostname)) {
      ignoredSites.push(hostname)
      console.warn(`Site ${hostname} add to ignore`)
      await chromeStorageLocalSet('ignoredSites', ignoredSites)
    }
  }
}

const onErrorOccurred = async ({ url, error, tabId }) => {
  const errorText = error.replace('net::', '')
  const urlObject = new URL(url)
  const hostname = urlObject.hostname
  const encodedUrl = window.btoa(url)

  const { enableExtension, ignoredSites } = await chromeStorageLocalGet({
    enableExtension: true,
    ignoredSites: [],
  })

  if (!enableExtension) {
    return
  }

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
    if (!ignoredSites.includes(hostname)) {
      ignoredSites.push(hostname)
      await chromeStorageLocalSet('ignoredSites', ignoredSites)
      chrome.tabs.update({
        url: url.replace('https:', 'http:'),
      })
    }
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

const notificationOnButtonClicked = (notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    chrome.tabs.query(
      {
        active: true,
        lastFocusedWindow: true,
      },
      (tabs) => {
        const activeTab = tabs[0]
        const urlObject = new URL(activeTab.url)
        const hostname = urlObject.hostname

        chrome.storage.local.get(
          {
            mutedForever: [],
          },
          (result) => {
            const mutedForever = result.mutedForever

            if (!mutedForever.find((item) => item === hostname)) {
              mutedForever.push(hostname)
              chrome.storage.local.set(
                {
                  mutedForever,
                },
                () => {
                  console.warn(
                    `Resource ${hostname} added to ignore. We won't notify you about it anymore`,
                  )
                },
              )
            }
          },
        )
      },
    )
  }
}

const updateTabState = async () => {
  const { enableExtension } = await chromeStorageLocalGet({
    enableExtension: true,
  })
  const [tab] = await chromeTabsQuery({
    active: true,
    lastFocusedWindow: true,
  })

  if (!tab || !shortcuts.validURL(tab.url)) {
    return
  }

  if (!enableExtension) {
    setPageIcon(tab.id, settings.getDisabledIcon())
    return
  }

  const urlObject = new URL(tab.url)
  const currentHostname = shortcuts.cleanHostname(urlObject.hostname)

  const { url, cooperationRefused } = await registry.distributorsContains(currentHostname)
    .catch((error) => {
      console.log(error)
    })

  const { domainFound } = await registry.domainsContains(currentHostname)
    .catch((error) => {
      console.log(error)
    })

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

    chrome.storage.local.set({ notifiedHosts }, () => {
      console.warn('The list of the notified ORI resource updated!')
    })
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
  await chromeStorageLocalRemove('notifiedHosts').catch(console.error)
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
