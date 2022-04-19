const getBrowser = () => {
  try {
    return browser
  } catch (error) {
    return chrome
  }
}

const currentBrowser = getBrowser()

export const set = async (keys = {}) => {
  await currentBrowser.storage.local.set(keys).then()
}

export const get = async (keys = {}) => {
  // eslint-disable-next-line no-return-await
  return await currentBrowser.storage.local.get(keys)
}

export const clear = async () => {
  await currentBrowser.storage.local.clear()
}

export const remove = async (keys = []) => {
  await currentBrowser.storage.local.remove(keys)
}

export default {
  set,
  get,
  clear,
  remove,
}
