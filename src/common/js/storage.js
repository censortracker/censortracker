const getBrowser = () => {
  try {
    return browser
  } catch (error) {
    return chrome
  }
}

const currentBrowser = getBrowser()

export const set = async (keys = {}) => {
  try {
    await currentBrowser.storage.local.set(keys)
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}

export const get = async (keys = {}) => {
  try {
    return await currentBrowser.storage.local.get(keys)
  } catch (error) {
    console.error(error)
    return {}
  }
}

export const clear = async () => {
  try {
    await currentBrowser.storage.local.clear()
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}

export const remove = async (keys = []) => {
  try {
    await currentBrowser.storage.local.remove(keys)
    return true
  } catch (error) {
    console.error(error)
    return false
  }
}

export default {
  set,
  get,
  clear,
  remove,
}
