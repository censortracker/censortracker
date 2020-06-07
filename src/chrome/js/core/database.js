class Database {
  static get (key, defaultValue) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.get(key, (result) => {
          resolve(result)
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  static set (key, value) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.set({ [key]: value }, () => {
          resolve({ [key]: value })
        })
      } catch (error) {
        reject(error)
      }
    })
  }

  static remove (key) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.remove(key, (result) => {
          resolve(result)
        })
      } catch (error) {
        reject(error)
      }
    })
  }
}

export default Database
