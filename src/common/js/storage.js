const getBrowser = () => {
  try {
    browser.runtime.getBrowserInfo()
    return browser
  } catch (error) {
    return chrome
  }
}

const currentBrowser = getBrowser()

class Storage {
  set = async (keys = {}) => {
    try {
      await currentBrowser.storage.local.set(keys)
      return true
    } catch (error) {
      console.error(error)
      return false
    }
  }

  get = async (keys = {}) => {
    try {
      return await currentBrowser.storage.local.get(keys)
    } catch (error) {
      console.error(error)
      return {}
    }
  }

  clear = async () => {
    try {
      await currentBrowser.storage.local.clear()
      return true
    } catch (error) {
      console.error(error)
      return false
    }
  }

  remove = async (keys = []) => {
    try {
      await currentBrowser.storage.local.remove(keys)
      return true
    } catch (error) {
      console.error(error)
      return false
    }
  }
}

export default new Storage()
