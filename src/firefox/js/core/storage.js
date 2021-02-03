class Storage {
  set = async (keys = {}) => {
    try {
      await browser.storage.local.set(keys)
      return true
    } catch (error) {
      console.error(error)
      return false
    }
  }

  get = async (keys = {}) => {
    try {
      return await browser.storage.local.get(keys)
    } catch (error) {
      console.error(error)
      return {}
    }
  }

  clear = async () => {
    try {
      await browser.storage.local.clear()
      return true
    } catch (error) {
      console.error(error)
      return false
    }
  }

  remove = async (keys = []) => {
    try {
      await browser.storage.local.remove(keys)
      return true
    } catch (error) {
      console.error(error)
      return false
    }
  }
}

export default new Storage()
