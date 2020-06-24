import {
  proxies,
  Database,
  registry,
  sessions,
  settings,
  shortcuts,
} from './core'

import {
  chromeStorageLocalRemove,
} from './promises'

const REQUEST_FILTERS = {
  urls: ['*://*/*'],
  types: ['main_frame'],
}
const MAX_REDIRECTIONS_COUNT = 6
const ERR_CONNECTION_RESET = 'ERR_CONNECTION_RESET'
const ERR_CONNECTION_CLOSED = 'ERR_CONNECTION_CLOSED'
const ERR_CERT_COMMON_NAME_INVALID = 'ERR_CERT_COMMON_NAME_INVALID'
const ERR_HTTP2_PROTOCOL_ERROR = 'ERR_HTTP2_PROTOCOL_ERROR'
const ERR_CERT_AUTHORITY_INVALID = 'ERR_CERT_AUTHORITY_INVALID'
const ERR_CONNECTION_TIMED_OUT = 'ERR_CONNECTION_TIMED_OUT'
const ERR_TUNNEL_CONNECTION_FAILED = 'ERR_TUNNEL_CONNECTION_FAILED'
const ERR_PROXY_CONNECTION_FAILED = 'ERR_PROXY_CONNECTION_FAILED'

window.censortracker = {
  proxies,
  Database,
  registry,
  sessions,
  settings,
  shortcuts,
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

const onBeforeRedirect = (details) => {
  const requestId = details.requestId
  const urlObject = new URL(details.url)
  const hostname = urlObject.hostname
  const redirectCountKey = 'redirectCount'

  const count = sessions.getRequest(requestId, redirectCountKey, 0)

  if (count) {
    sessions.putRequest(requestId, redirectCountKey, count + 1)
  } else {
    sessions.putRequest(requestId, redirectCountKey, 1)
  }

  if (areMaxRedirectsReached(count)) {
    if (chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {
      chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest)
    }
    console.warn(`Reached max count of redirects. Adding "${hostname}" to ignore...`)

    Database.get({ ignoredSites: [] })
      .then(({ ignoredSites }) => {
        if (!ignoredSites.includes(hostname)) {
          ignoredSites.push(hostname)
          console.warn(`Site ${hostname} add to ignore`)
          Database.set('ignoredSites', ignoredSites)
        }
      })
  }
}

const areMaxRedirectsReached = (count) => count >= MAX_REDIRECTIONS_COUNT

const onErrorOccurred = ({ url, error, tabId }) => {
  const errorText = error.replace('net::', '')
  const urlObject = new URL(url)
  const hostname = urlObject.hostname
  const encodedUrl = window.btoa(url)

  if (isThereProxyConnectionError(errorText)) {
    chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL('proxy_unavailable.html'),
    })
  }

  if (isThereConnectionError(errorText)) {
    console.warn('Possible DPI lock detected: reporting domain...')
    proxies.setProxy(hostname)
    registry.reportBlockedByDPI(hostname)
    chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL(`unavailable.html?${encodedUrl}`),
    })
  }

  if (isThereCertificateError(errorText) || isThereAvailabilityError(errorText)) {
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

const isThereProxyConnectionError = (error) => [
  ERR_TUNNEL_CONNECTION_FAILED,
  ERR_PROXY_CONNECTION_FAILED,
].includes(error)

const isThereConnectionError = (error) => [
  ERR_CONNECTION_RESET,
  ERR_CONNECTION_CLOSED,
  ERR_CONNECTION_TIMED_OUT,
].includes(error)

const isThereCertificateError = (error) => [
  ERR_CERT_AUTHORITY_INVALID,
  ERR_CERT_COMMON_NAME_INVALID,
].includes(error)

const isThereAvailabilityError = (error) => [
  ERR_HTTP2_PROTOCOL_ERROR,
].includes(error)

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

const updateState = async () => {
  chrome.storage.local.get(
    {
      enableExtension: true,
      ignoredSites: [],
    },
    (config) => {
      chrome.tabs.query(
        {
          active: true,
          lastFocusedWindow: true,
        },
        ([tab]) => {
          if (!tab || !tab.url) {
            return
          }
          const tabId = tab.id
          const urlObject = new URL(tab.url)

          if (urlObject.protocol === 'chrome:') {
            return
          }
          const currentHostname = shortcuts.cleanHostname(urlObject.hostname)
          const ignoredSites = config.ignoredSites

          if (ignoredSites.includes(currentHostname)) {
            console.warn(`Site ${currentHostname} found in ignore`)
            chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest)
            return
          }

          if (config.enableExtension) {
            if (
              !chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)
            ) {
              chrome.webRequest.onBeforeRequest.addListener(
                onBeforeRequest,
                REQUEST_FILTERS,
                ['blocking'],
              )
            }

            if (
              !chrome.webRequest.onErrorOccurred.hasListener(onErrorOccurred)
            ) {
              chrome.webRequest.onErrorOccurred.addListener(
                onErrorOccurred,
                REQUEST_FILTERS,
              )
            }

            registry.distributorsContains(currentHostname)
              .then((cooperationRefused) => {
                setPageIcon(tabId, settings.getLockFoundIcon())
                if (!cooperationRefused) {
                  // Shows special icon here
                  setPageIcon(tabId, settings.getDistributorFoundIcon())
                  showCooperationAcceptedWarning(currentHostname)
                }
              })

            registry.domainsContains(currentHostname)
              .then((_data) => {
                setPageIcon(tabId, settings.getLockFoundIcon())
              })
              .catch(() => {
                registry.distributorsContains(currentHostname)
                  .then((cooperationRefused) => {
                    setPageIcon(tabId, settings.getLockFoundIcon())
                    if (!cooperationRefused) {
                      // Shows special icon here
                      setPageIcon(tabId, settings.getDistributorFoundIcon())
                    }
                  })
              })
          } else {
            if (
              chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)
            ) {
              chrome.webRequest.onBeforeRequest.removeListener(
                onBeforeRequest,
              )
            }

            if (
              chrome.webRequest.onErrorOccurred.hasListener(onErrorOccurred)
            ) {
              chrome.webRequest.onErrorOccurred.removeListener(
                onErrorOccurred,
              )
            }
          }
        },
      )
    },
  )
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
      iconUrl: settings.getDistributorFoundIcon(),
    })

    notifiedHosts.push(hostname)

    chrome.storage.local.set({ notifiedHosts }, () => {
      console.warn('The list of the notified ORI resource updated!')
    })
  }
}

chrome.runtime.onInstalled.addListener(({ reason }) => {
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
    proxies.openPorts()
    settings.enableExtension()
    proxies.setProxy()
  }
})

chrome.runtime.onStartup.addListener(async () => {
  await registry.syncDatabase()
  await updateState()
})

chrome.windows.onRemoved.addListener(async (_windowId) => {
  await chromeStorageLocalRemove('notifiedHosts').catch(console.error)
  console.warn('A list of notified hosts has been cleaned up!')
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

chrome.tabs.onActivated.addListener(updateState)
chrome.tabs.onUpdated.addListener(updateState)

setInterval(() => {
  proxies.openPorts()
}, 60 * 1000 * 3)
