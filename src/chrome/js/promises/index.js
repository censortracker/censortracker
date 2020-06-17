export const chromeDeclarativeContentOnPageChangedAddRules = (...args) => new Promise((resolve, reject) => {
  args.push(resolve)
  try {
    chrome.declarativeContent.onPageChanged.addRules(...args)
  } catch (error) {
    reject(error)
  }
})

export const chromeDeclarativeContentOnPageChangedRemoveRules = (...args) => new Promise((resolve, reject) => {
  args.push(resolve)
  try {
    chrome.declarativeContent.onPageChanged.removeRules(...args)
  } catch (error) {
    reject(error)
  }
})

export const chromeDeclarativeContentPageStateMatcher = (...args) => new Promise((resolve, reject) => {
  args.push(resolve)
  try {
    chrome.declarativeContent.PageStateMatcher(...args)
  } catch (error) {
    reject(error)
  }
})

export const chromeDeclarativeContentShowPageAction = (...args) => new Promise((resolve, reject) => {
  args.push(resolve)
  try {
    chrome.declarativeContent.ShowPageAction(...args)
  } catch (error) {
    reject(error)
  }
})

export const chromeExtensionGetURL = (...args) => new Promise((resolve, reject) => {
  args.push(resolve)
  try {
    chrome.extension.getURL(...args)
  } catch (error) {
    reject(error)
  }
})

export const chromeNotificationsCreate = (...args) => new Promise((resolve, reject) => {
  args.push(resolve)
  try {
    chrome.notifications.create(...args)
  } catch (error) {
    reject(error)
  }
})

export const chromePageActionSetIcon = (...args) => new Promise((resolve, reject) => {
  args.push(resolve)
  try {
    chrome.pageAction.setIcon(...args)
  } catch (error) {
    reject(error)
  }
})

export const chromePageActionSetTitle = (...args) => new Promise((resolve, reject) => {
  args.push(resolve)
  try {
    chrome.pageAction.setTitle(...args)
  } catch (error) {
    reject(error)
  }
})

export const chromeProxySettingsClear = (...args) => new Promise((resolve, reject) => {
  args.push(resolve)
  try {
    chrome.proxy.settings.clear(...args)
  } catch (error) {
    reject(error)
  }
})

export const chromeProxySettingsSet = (...args) => new Promise((resolve, reject) => {
  args.push(resolve)
  try {
    chrome.proxy.settings.set(...args)
  } catch (error) {
    reject(error)
  }
})

export const chromeRuntimeGetBackgroundPage = (...args) => new Promise((resolve, reject) => {
  args.push(resolve)
  try {
    chrome.runtime.getBackgroundPage(...args)
  } catch (error) {
    reject(error)
  }
})

export const chromeRuntimeGetManifest = (...args) => new Promise((resolve, reject) => {
  args.push(resolve)
  try {
    chrome.runtime.getManifest(...args)
  } catch (error) {
    reject(error)
  }
})

export const chromeRuntimeGetURL = (...args) => new Promise((resolve, reject) => {
  args.push(resolve)
  try {
    chrome.runtime.getURL(...args)
  } catch (error) {
    reject(error)
  }
})

export const chromeRuntimeLastError = (...args) => new Promise((resolve, reject) => {
  args.push(resolve)
  try {
    chrome.runtime.lastError(...args)
  } catch (error) {
    reject(error)
  }
})

export const chromeStorageLocalGet = (...args) => new Promise((resolve, reject) => {
  args.push(resolve)
  try {
    chrome.storage.local.get(...args)
  } catch (error) {
    reject(error)
  }
})

export const chromeStorageLocalRemove = (...args) => new Promise((resolve, reject) => {
  args.push(resolve)
  try {
    chrome.storage.local.remove(...args)
  } catch (error) {
    reject(error)
  }
})

export const chromeStorageLocalSet = (...args) => new Promise((resolve, reject) => {
  args.push(resolve)
  try {
    chrome.storage.local.set(...args)
  } catch (error) {
    reject(error)
  }
})

export const chromeTabsCreate = (...args) => new Promise((resolve, reject) => {
  args.push(resolve)
  try {
    chrome.tabs.create(...args)
  } catch (error) {
    reject(error)
  }
})

export const chromeTabsQuery = (...args) => new Promise((resolve, reject) => {
  args.push(resolve)
  try {
    chrome.tabs.query(...args)
  } catch (error) {
    reject(error)
  }
})

export const chromeTabsRemove = (...args) => new Promise((resolve, reject) => {
  args.push(resolve)
  try {
    chrome.tabs.remove(...args)
  } catch (error) {
    reject(error)
  }
})

export const chromeTabsUpdate = (...args) => new Promise((resolve, reject) => {
  args.push(resolve)
  try {
    chrome.tabs.update(...args)
  } catch (error) {
    reject(error)
  }
})
