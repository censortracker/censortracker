import asynchrome from '../../chrome/js/core/asynchrome'

class StorageProxy {
  constructor () {
    try {
      this.browser = browser
    } catch (error) {
      this.browser = asynchrome
    }
  }

  set = async (keys = {}) => {
    try {
      await this.browser.storage.local.set(keys)
      return true
    } catch (error) {
      console.error(error)
      return false
    }
  }

  get = async (keys = {}) => {
    try {
      return await this.browser.storage.local.get(keys)
    } catch (error) {
      console.error(error)
      return {}
    }
  }

  clear = async () => {
    try {
      await this.browser.storage.local.clear()
      return true
    } catch (error) {
      console.error(error)
      return false
    }
  }

  remove = async (keys = []) => {
    try {
      await this.browser.storage.local.remove(keys)
      return true
    } catch (error) {
      console.error(error)
      return false
    }
  }
}

export default new StorageProxy()
