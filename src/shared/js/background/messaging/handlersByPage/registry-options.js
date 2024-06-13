import { Extension } from '../../../extension'
import * as server from '../../../extension/base/server'

export const handleRegistryOptionsMessage = (
  message,
  _sender,
  sendResponse) => {
  const { request, payload } = message

  switch (request) {
    case 'enableRegistry':
      (async () => {
        await Extension.registry.enable()
        await server.synchronize()
        await Extension.proxy.setProxy()
        return true
      })()
      return true
    case 'disableRegistry':
      (async () => {
        await Extension.registry.clear()
        await Extension.registry.disable()
        await Extension.proxy.removeProxy()
        await Extension.config.set({ currentRegionName: '' })
        await Extension.proxy.setProxy()
        return true
      })()
      return true
    case 'setCountry':
      Extension.config.set(payload)
      return true
    default:
      console.warn(`unknown request: ${request}`)
  }
  return true
}
