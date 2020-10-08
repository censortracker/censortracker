
const promisify = ({ ns, fn }, ...args) => new Promise((resolve, reject) => {
  if (!Object.hasOwnProperty.call(ns, fn)) {
    throw new Error(`The namespace has not a method: ${fn}`)
  }

  ns[fn](...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

class Asynchrome {
  constructor () {
    this.chrome = chrome
    this.proxy = {
      settings: {
        set: (...args) =>
          promisify({
            ns: this.chrome.proxy.settings,
            fn: 'set',
          }, ...args),
        clear: (...args) =>
          promisify({
            ns: this.chrome.proxy.settings,
            fn: 'clear',
          }, ...args),
        get: () =>
          promisify({
            ns: this.chrome.proxy.settings,
            fn: 'get',
          }, { incognito: false }),
      },
    }
    this.declarativeContent = {
      PageStateMatcher: (...args) => promisify({
        ns: this.chrome.declarativeContent,
        fn: 'PageStateMatcher',
      }, ...args),
      ShowPageAction: (...args) => promisify({
        ns: this.chrome.declarativeContent,
        fn: 'ShowPageAction',
      }, ...args),
      removeRules: (...args) => promisify({
        ns: this.chrome.declarativeContent.onPageChanged,
        fn: 'removeRules',
      }, ...args),
      addRules: (...args) => promisify({
        ns: this.chrome.declarativeContent.onPageChanged,
        fn: 'addRules',
      }, ...args),
    }
    this.storage = {
      local: {
        get: (...args) => promisify({
          ns: this.chrome.storage.local,
          fn: 'get',
        }, ...args),
        set: (...args) => promisify({
          ns: this.chrome.storage.local,
          fn: 'set',
        }, ...args),
        remove: (...args) => promisify({
          ns: this.chrome.storage.local,
          fn: 'remove',
        }, ...args),
      },
    }
    this.notifications = {
      create: (...args) => promisify({
        ns: chrome.notifications,
        fn: 'create',
      }, ...args),
    }
    this.extension = {
      getURL: (...args) => promisify({
        ns: this.chrome.extension,
        fn: 'getURL',
      }, ...args),
    }
    this.runtime = {
      getURL: (...args) => promisify({
        ns: this.chrome.runtime,
        fn: 'getURL',
      }, ...args),
      getManifest: (...args) => promisify({
        ns: this.chrome.runtime,
        fn: 'getManifest',
      }, ...args),
      lastError: (...args) => promisify({
        ns: this.chrome.runtime,
        fn: 'lastError',
      }, ...args),
      getBackgroundPage: (...args) => promisify({
        ns: this.chrome.runtime,
        fn: 'getBackgroundPage',
      }, ...args),
    }
    this.tabs = {
      create: (...args) => promisify({
        ns: this.chrome.tabs,
        fn: 'create',
      }, ...args),
      query: (...args) => promisify({
        ns: this.chrome.tabs,
        fn: 'query',
      }, ...args),
      remove: (...args) => promisify({
        ns: this.chrome.tabs,
        fn: 'remove',
      }, ...args),
      update: (...args) => promisify({
        ns: this.chrome.tabs,
        fn: 'update',
      }, ...args),
    }
    this.pageAction = {
      setIcon: (...args) => promisify({
        ns: this.chrome.pageAction,
        fn: 'setIcon',
      }, ...args),
      setTitle: (...args) => promisify({
        ns: this.chrome.pageAction,
        fn: 'setTitle',
      }, ...args),
    }
    this.management = {
      getAll: (...args) => promisify({
        ns: this.chrome.management,
        fn: 'getAll',
      }, ...args),
      getSelf: (...args) => promisify({
        ns: this.chrome.management,
        fn: 'getSelf',
      }, ...args),
      setEnabled: (...args) => promisify({
        ns: this.chrome.management,
        fn: 'setEnabled',
      }, ...args),
    }
  }
}

export default new Asynchrome()
