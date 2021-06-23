
const promisify = ({ ns, fn }, ...args) => new Promise((resolve, reject) => {
  ns[fn](...args, (...result) => {
    if (chrome.runtime.lastError) {
      return reject(chrome.runtime.lastError)
    }
    return resolve(...result)
  })
})

// TODO: create its properties dynamically
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
    this.storage = {
      local: {
        set: (object) => new Promise((resolve, reject) => {
          chrome.storage.local.set(object, () => {
            if (chrome.runtime.lastError) {
              return reject(chrome.runtime.lastError)
            }
            return resolve(true)
          })
        }),
        remove: (...args) => promisify({
          ns: this.chrome.storage.local,
          fn: 'remove',
        }, ...args),
        clear: () => promisify({
          ns: this.chrome.storage.local, fn: 'clear',
        }),
        get: (object) => new Promise((resolve, reject) => {
          chrome.storage.local.get(object, (...result) => {
            if (chrome.runtime.lastError) {
              return reject(chrome.runtime.lastError)
            }
            return resolve(...result)
          })
        }),
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
      getURL: (path) => this.chrome.runtime.getURL(path),
      getManifest: () => this.chrome.runtime.getManifest(),
      getBackgroundPage: (...args) => promisify({
        ns: this.chrome.runtime,
        fn: 'getBackgroundPage',
      }, ...args),
      openOptionsPage: (...args) => promisify({
        ns: this.chrome.runtime,
        fn: 'openOptionsPage',
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
    this.i18n = {
      getMessage: (...args) => this.chrome.i18n.getMessage(...args),
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
