import {
  asynchrome,
  errors,
  proxies,
  registry,
  settings,
  shortcuts,
} from './core'

window.censortracker = {
  proxies,
  registry,
  settings,
  shortcuts,
  errors,
  asynchrome,
}

const onBeforeRequestListener = ({ url }) => {
  const { hostname } = new URL(url)

  if (shortcuts.isIgnoredHost(hostname)) {
    console.warn(`Ignoring host: ${url}`)
    return undefined
  }
  proxies.allowProxying()
  return {
    redirectUrl: shortcuts.enforceHttps(url),
  }
}

chrome.webRequest.onBeforeRequest.addListener(
  onBeforeRequestListener, {
    urls: ['http://*/*'],
    types: ['main_frame'],
  }, ['blocking'],
)

const onErrorOccurredListener = async ({ url, error, tabId }) => {
  const { hostname } = new URL(url)

  if (shortcuts.isIgnoredHost(hostname)) {
    return
  }

  if (errors.isThereProxyConnectionError(error)) {
    chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL('proxy_unavailable.html'),
    })
    return
  }

  if (errors.isThereConnectionError(error)) {
    chrome.tabs.update(tabId, {
      url: chrome.runtime.getURL(`unavailable.html?${window.btoa(url)}`),
    })
    await registry.addBlockedByDPI(hostname)
    await proxies.setProxy()
    return
  }

  await shortcuts.addHostToIgnore(hostname)
  chrome.tabs.update(tabId, {
    url: url.replace('https:', 'http:'),
  })
}

chrome.webRequest.onErrorOccurred.addListener(
  onErrorOccurredListener,
  {
    urls: ['http://*/*', 'https://*/*'],
    types: ['main_frame'],
  },
)

const notificationOnButtonClicked = async (notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    const [tab] = await asynchrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    })

    const { hostname } = new URL(tab.url)
    const { mutedForever } =
      await asynchrome.storage.local.get({ mutedForever: [] })

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

  const { enableExtension } = await asynchrome.storage.local.get({
    enableExtension: true,
  })

  if (!enableExtension) {
    settings.setDisableIcon(tab.id)
    return
  }

  const { hostname } = new URL(tab.url)
  const currentHostname = shortcuts.cleanHostname(hostname)

  if (shortcuts.isIgnoredHost(currentHostname)) {
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
    if (!cooperationRefused) {
      await showCooperationAcceptedWarning(currentHostname)
    }
  }
}

const showCooperationAcceptedWarning = async (hostname) => {
  if (!hostname) {
    return
  }

  const { notifiedHosts, mutedForever } = await asynchrome.storage.local.get({
    notifiedHosts: [],
    mutedForever: [],
  })

  if (mutedForever.includes(hostname)) {
    return
  }

  if (!notifiedHosts.includes(hostname)) {
    await asynchrome.notifications.create({
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

    try {
      notifiedHosts.push(hostname)
      await asynchrome.storage.local.set({ notifiedHosts })
    } catch (error) {
      console.error(error)
    }
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
      settings.enableExtension()
      await proxies.setProxy()
    }
  }
})

const onTabCreated = async (tab) => {
  const { enableExtension } =
    await asynchrome.storage.local.get({ enableExtension: true })

  if (enableExtension === false) {
    settings.setDisableIcon(tab.id)
  } else {
    settings.setDefaultIcon(tab.id)
  }
}

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

chrome.notifications.onButtonClicked.addListener(notificationOnButtonClicked)

chrome.tabs.onActivated.addListener(updateTabState)
chrome.tabs.onUpdated.addListener(updateTabState)
chrome.tabs.onCreated.addListener(onTabCreated)

window.censortracker.chromeListeners = {
  remove: () => {
    chrome.webRequest.onErrorOccurred.removeListener(onErrorOccurredListener)
    chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequestListener)
  },
  add: () => {
    chrome.webRequest.onErrorOccurred.addListener(onErrorOccurredListener, {
      urls: ['http://*/*', 'https://*/*'],
      types: ['main_frame'],
    })
    chrome.webRequest.onBeforeRequest.addListener(
      onBeforeRequestListener, {
        urls: ['http://*/*'],
        types: ['main_frame'],
      },
      ['blocking'],
    )
  },
}
