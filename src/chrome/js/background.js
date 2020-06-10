import {
  proxies,
  Database,
  registry,
  sessions,
  settings,
  shortcuts,
} from './core'

const REQUEST_FILTERS = {
  urls: ['*://*/*'],
  types: ['main_frame'],
}
const MAX_REDIRECTIONS_COUNT = 6
const ERR_CONNECTION_RESET = 'ERR_CONNECTION_RESET'
const ERR_CONNECTION_CLOSED = 'ERR_CONNECTION_CLOSED'
const ERR_CERT_COMMON_NAME_INVALID = 'ERR_CERT_COMMON_NAME_INVALID'
const ERR_HTTP2_PROTOCOL_ERROR = 'ERR_HTTP2_PROTOCOL_ERROR'
const ERR_TUNNEL_CONNECTION_FAILED = 'ERR_TUNNEL_CONNECTION_FAILED'
const ERR_CERT_AUTHORITY_INVALID = 'ERR_CERT_AUTHORITY_INVALID'
const ERR_CONNECTION_TIMED_OUT = 'ERR_CONNECTION_TIMED_OUT'
const RED_ICON = chrome.extension.getURL('images/red_icon.png')

window.censortracker = {
  proxies,
  Database,
  registry,
  sessions,
  settings,
  shortcuts,
}

const onInstalled = (details) => {
  if (details.reason === 'install') {
    console.log(`Installing ${settings.getName()}...`)
    proxies.openPorts()
    shortcuts.enableExtension()
    registry.syncDatabase()
    proxies.setProxy()
  }
}

const onWindowsRemoved = (_windowId) => {
  chrome.storage.local.remove(['notifiedHosts'], () => {
    if (!chrome.runtime.lastError) {
      console.warn('An array of notified hosts has been cleaned up.')
      return true
    }
    console.error('Error on removing notified hosts.')
    return false
  })
}

const onStartup = async () => {
  await registry.syncDatabase()
  await updateState()
}

const onBeforeRequest = (details) => {
  if (shortcuts.validURL(details.url)) {
    console.log('Redirecting request to HTTPS...')
    return {
      redirectUrl: details.url.replace(/^http:/, 'https:'),
    }
  }
  return null
}

const onBeforeRedirect = (details) => {
  const requestId = details.requestId
  const urlObject = new URL(details.url)
  const hostname = urlObject.hostname

  const count = sessions.getRequest(requestId, 'redirect_count', 0)

  if (count) {
    sessions.putRequest(requestId, 'redirect_count', count + 1)
  } else {
    sessions.putRequest(requestId, 'redirect_count', 1)
  }

  if (count >= MAX_REDIRECTIONS_COUNT) {
    if (chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {
      chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest)
    }
    console.warn('Reached max count of redirects. Adding site to ignore...')

    Database.get('ignoredSites')
      .then(({ ignoredSites }) => {
        if (ignoredSites && !ignoredSites.includes(hostname)) {
          ignoredSites.push(hostname)
          console.warn(`Site ${hostname} add to ignore`)
          Database.set('ignoredSites', ignoredSites)
        }
      })
  }
}

const onErrorOccurred = (details) => {
  // Removes "net::" from string
  const error = details.error.substr(5)
  const urlObject = new URL(details.url)
  const hostname = urlObject.hostname
  const encodedURL = window.btoa(details.url)

  // Most likely in this case domain was blocked by DPI
  if (
    error === ERR_CONNECTION_RESET ||
    error === ERR_CONNECTION_CLOSED ||
    error === ERR_CONNECTION_TIMED_OUT
  ) {
    console.warn('Possible DPI lock detected: updating PAC file...')
    proxies.setProxy(hostname)
    registry.reportBlockedByDPI(hostname)
    chrome.tabs.update({
      url: chrome.runtime.getURL(`refused.html?${encodedURL}`),
    })
  }

  if (
    error === ERR_HTTP2_PROTOCOL_ERROR ||
    error === ERR_CERT_COMMON_NAME_INVALID ||
    error === ERR_TUNNEL_CONNECTION_FAILED ||
    error === ERR_CERT_AUTHORITY_INVALID
  ) {
    console.warn('Certificate validation issue. Adding hostname to ignore...')
    chrome.storage.local.get(
      {
        ignoredSites: [],
      },
      (data) => {
        const ignoredSites = data.ignoredSites

        if (!ignoredSites.includes(hostname)) {
          ignoredSites.push(hostname)
          chrome.storage.local.set({
            ignoredSites,
          })
        }

        if (chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {
          chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest)
        }

        chrome.tabs.update({
          url: details.url.replace('https:', 'http:'),
        })
      },
    )
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

            registry.checkDistributors(currentHostname)
              .then((cooperationRefused) => {
                setMatchFoundIcon(tabId)
                if (!cooperationRefused) {
                  // Shows special icon here
                  setMatchFoundIcon(tabId)
                  showCooperationAcceptedWarning(currentHostname)
                }
              })

            registry.checkDomains(currentHostname)
              .then((_data) => {
                setMatchFoundIcon(tabId)
              })
              .catch(() => {
                registry.checkDistributors(currentHostname)
                  .then((cooperationRefused) => {
                    setMatchFoundIcon(tabId)
                    if (!cooperationRefused) {
                      // Shows special icon here
                      setMatchFoundIcon(tabId)
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

const setMatchFoundIcon = (tabId) => {
  chrome.pageAction.setIcon({
    tabId,
    path: RED_ICON,
  })
  chrome.pageAction.setTitle({
    title: settings.getTitle(),
    tabId,
  })
}

const showCooperationAcceptedWarning = (hostname) => {
  chrome.storage.local.get(
    { notifiedHosts: [], mutedForever: [] },
    (result) => {
      if (!result || !hostname) {
        return
      }

      const mutedForever = result.mutedForever

      if (mutedForever.find((item) => item === hostname)) {
        return
      }

      const notifiedHosts = result.notifiedHosts

      if (!notifiedHosts.find((item) => item === hostname)) {
        chrome.notifications.create({
          type: 'basic',
          title: `Censor Tracker: ${hostname}`,
          priority: 2,
          message: 'Этот ресурс может передавать информацию третьим лицам.',
          buttons: [
            { title: '\u2715 Не показывать для этого сайта' },
            { title: '\u2192 Подробнее' },
          ],
          iconUrl: RED_ICON,
        })
      }

      if (!notifiedHosts.includes(hostname)) {
        notifiedHosts.push(hostname)
        chrome.storage.local.set({ notifiedHosts }, () => {
          console.warn('The list of the notified ORI resource updated!')
        })
      }
    },
  )
}

chrome.runtime.onInstalled.addListener(onInstalled)
chrome.runtime.onInstalled.addListener(() => {
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
})
chrome.windows.onRemoved.addListener(onWindowsRemoved)
chrome.runtime.onStartup.addListener(onStartup)
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

// chrome.pageAction.onClicked.addListener((tab) => {
//   chrome.pageAction.setIcon({path: "icon" + (clicks + 1) + ".png",
//                              tabId: tab.id})
//   if (clicks % 2) {
//     chrome.pageAction.show(tab.id)
//   } else {
//     chrome.pageAction.hide(tab.id)
//     setTimeout(function() { chrome.pageAction.show(tab.id) }, 200)
//   }
//   chrome.pageAction.setTitle({title: "click:" + clicks, tabId: tab.id})
//   // We only have 2 icons, but cycle through 3 icons to test the
//   // out-of-bounds index bug.
//   clicks++
//   if (clicks > 3)
//     clicks = 0
//   tab_clicks[tab.id] = clicks
// })

setInterval(() => {
  proxies.openPorts()
}, 60 * 1000 * 3)

// chrome.storage.local.get((data) => {
//   console.log(data)
//   console.log(window.censortracker)
// })
