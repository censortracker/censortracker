export const chromeDeclarativeContentOnPageChangedAddRules = (...args) => new Promise((resolve, reject) => {
  chrome.declarativeContent.onPageChanged.addRules(...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

export const chromeDeclarativeContentOnPageChangedRemoveRules = (...args) => new Promise((resolve, reject) => {
  chrome.declarativeContent.onPageChanged.removeRules(...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

export const chromeDeclarativeContentPageStateMatcher = (...args) => new Promise((resolve, reject) => {
  chrome.declarativeContent.PageStateMatcher(...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

export const chromeDeclarativeContentShowPageAction = (...args) => new Promise((resolve, reject) => {
  chrome.declarativeContent.ShowPageAction(...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

export const chromeExtensionGetURL = (...args) => new Promise((resolve, reject) => {
  chrome.extension.getURL(...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

export const chromeNotificationsCreate = (...args) => new Promise((resolve, reject) => {
  chrome.notifications.create(...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

export const chromePageActionSetIcon = (...args) => new Promise((resolve, reject) => {
  chrome.pageAction.setIcon(...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

export const chromePageActionSetTitle = (...args) => new Promise((resolve, reject) => {
  chrome.pageAction.setTitle(...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

export const chromeProxySettingsClear = (...args) => new Promise((resolve, reject) => {
  chrome.proxy.settings.clear(...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

export const chromeProxySettingsSet = (...args) => new Promise((resolve, reject) => {
  chrome.proxy.settings.set(...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

export const chromeRuntimeGetBackgroundPage = (...args) => new Promise((resolve, reject) => {
  chrome.runtime.getBackgroundPage(...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

export const chromeRuntimeGetManifest = (...args) => new Promise((resolve, reject) => {
  chrome.runtime.getManifest(...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

export const chromeRuntimeGetURL = (...args) => new Promise((resolve, reject) => {
  chrome.runtime.getURL(...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

export const chromeRuntimeLastError = (...args) => new Promise((resolve, reject) => {
  chrome.runtime.lastError(...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

export const chromeStorageLocalGet = (...args) => new Promise((resolve, reject) => {
  chrome.storage.local.get(...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

export const chromeStorageLocalRemove = (...args) => new Promise((resolve, reject) => {
  chrome.storage.local.remove(...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

export const chromeStorageLocalSet = (...args) => new Promise((resolve, reject) => {
  chrome.storage.local.set(...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

export const chromeTabsCreate = (...args) => new Promise((resolve, reject) => {
  chrome.tabs.create(...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

export const chromeTabsQuery = (...args) => new Promise((resolve, reject) => {
  chrome.tabs.query(...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

export const chromeTabsRemove = (...args) => new Promise((resolve, reject) => {
  chrome.tabs.remove(...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

export const chromeTabsUpdate = (...args) => new Promise((resolve, reject) => {
  chrome.tabs.update(...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})
