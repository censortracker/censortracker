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

  if (sessions.areMaxRedirectsReached(count)) {
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
    proxies.setProxy(hostname)
    registry.reportBlockedByDPI(hostname)
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

          if (shortcuts.isChromeExtensionUrl(tab.url)) {
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
              .then(({ url, cooperationRefused }) => {
                console.log(`URL: ${url} Cooperated: ${cooperationRefused}`)
                if (url) {
                  console.log(cooperationRefused)
                  setPageIcon(tabId, settings.getDangerIcon())
                  if (!cooperationRefused) {
                    showCooperationAcceptedWarning(currentHostname)
                  }
                } else {
                  setPageIcon(tabId, settings.getDefaultIcon())
                }
              })

            registry.domainsContains(currentHostname)
              .then((_data) => {
                if (_data.length > 0) {
                  setPageIcon(tabId, settings.getDangerIcon())
                }
              })
              .catch((error) => {
                console.log(error)
              })
          } else {
            setPageIcon(tabId, settings.getDisabledIcon())
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
      iconUrl: settings.getDangerIcon(),
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
