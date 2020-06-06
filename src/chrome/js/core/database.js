class Database {
  get (key, defaultValue) {
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

  set (key, value) {
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

  remove (key) {
    return new Promise((resolve, reject) => {
      try {
        chrome.storage.local.remove(key)
      } catch (error) {
        reject(error)
      }
    })
  }
}

export default Database
