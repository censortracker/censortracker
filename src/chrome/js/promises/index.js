const promisify = ({ ns, method }, ...args) => new Promise((resolve, reject) => {
  if (!Object.hasOwnProperty.call(ns, method)) {
    throw new Error(`The namespace has not a method: ${method}`)
  }

  ns[method](...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

export const chromeDeclarativeContentOnPageChangedAddRules = (...args) =>
  promisify({ ns: chrome.declarativeContent.onPageChanged, method: 'addRules' }, ...args)

export const chromeDeclarativeContentOnPageChangedRemoveRules = (...args) =>
  promisify({ ns: chrome.declarativeContent.onPageChanged, method: 'removeRules' }, ...args)

export const chromeDeclarativeContentPageStateMatcher = (...args) =>
  promisify({ ns: chrome.declarativeContent, method: 'PageStateMatcher' }, ...args)

export const chromeDeclarativeContentShowPageAction = (...args) =>
  promisify({ ns: chrome.declarativeContent, method: 'ShowPageAction' }, ...args)

export const chromeExtensionGetURL = (...args) =>
  promisify({ ns: chrome.extension, method: 'getURL' }, ...args)

export const chromeNotificationsCreate = (...args) =>
  promisify({ ns: chrome.notifications, method: 'create' }, ...args)

export const chromePageActionSetIcon = (...args) =>
  promisify({ ns: chrome.pageAction, method: 'setIcon' }, ...args)

export const chromePageActionSetTitle = (...args) =>
  promisify({ ns: chrome.pageAction, method: 'setTitle' }, ...args)

export const chromeProxySettingsClear = (...args) =>
  promisify({ ns: chrome.proxy.settings, method: 'clear' }, ...args)

export const chromeProxySettingsSet = (...args) =>
  promisify({ ns: chrome.proxy.settings, method: 'set' }, ...args)

export const chromeRuntimeGetBackgroundPage = (...args) =>
  promisify({ ns: chrome.runtime, method: 'getBackgroundPage' }, ...args)

export const chromeRuntimeGetManifest = (...args) =>
  promisify({ ns: chrome.runtime, method: 'getManifest' }, ...args)

export const chromeRuntimeGetURL = (...args) =>
  promisify({ ns: chrome.runtime, method: 'getURL' })

export const chromeRuntimeLastError = (...args) =>
  promisify({ ns: chrome.runtime, method: 'lastError' }, ...args)

export const chromeStorageLocalGet = (...args) =>
  promisify({ ns: chrome.storage.local, method: 'get' }, ...args)

export const chromeStorageLocalRemove = (...args) =>
  promisify({ ns: chrome.storage.local, method: 'remove' }, ...args)

export const chromeStorageLocalSet = (...args) =>
  promisify({ ns: chrome.storage.local, method: 'set' }, ...args)

export const chromeTabsCreate = (...args) =>
  promisify({ ns: chrome.tabs, method: 'create' }, ...args)

export const chromeTabsQuery = (...args) =>
  promisify({ ns: chrome.tabs, method: 'query' }, ...args)

export const chromeTabsRemove = (...args) =>
  promisify({ ns: chrome.tabs, method: 'remove' }, ...args)

export const chromeTabsUpdate = (...args) =>
  promisify({ ns: chrome.tabs, method: 'update' }, ...args)
