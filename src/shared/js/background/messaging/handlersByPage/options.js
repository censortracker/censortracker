import { Extension } from '../../../extension'

export const handleOptionsMessage = (
  message,
  _sender,
  sendResponse) => {
  const { request } = message

  switch (request) {
    case 'isRegistryEmpty':
      Extension.registry.isEmpty().then(
        (isEmpty) => {
          sendResponse(isEmpty)
          return true
        },
      )
      return true
    case 'update':
      Extension.config.set({ updateAvailable: false })
        .then(() => {
          browser.runtime.reload()
          return true
        })
      return true
    case 'setProxy':
      Extension.proxy.setProxy().then((proxySet) => {
        sendResponse(proxySet)
        return true
      })
      return true
    case 'grantIncognitoAccess':
      Extension.proxy.grantIncognitoAccess()
      return true
    default:
      console.warn(`unknown request: ${request}`)
  }
  return true
}
