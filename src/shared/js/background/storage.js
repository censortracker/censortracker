import Browser from './webextension'

export const set = async (keys = {}) => {
  await Browser.storage.local.set(keys)
}

export const get = async (keys = {}) => {
  // eslint-disable-next-line no-return-await
  return await Browser.storage.local.get(keys)
}

export const clear = async () => {
  await Browser.storage.local.clear()
}

export const remove = async (keys = []) => {
  await Browser.storage.local.remove(keys)
}

export default {
  set,
  get,
  clear,
  remove,
}
