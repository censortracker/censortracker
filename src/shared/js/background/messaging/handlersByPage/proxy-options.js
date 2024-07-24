import { Extension } from '../../../extension'

export const handleProxyOptionsMessage = (
  message,
  _sender,
  sendResponse) => {
  const { request } = message

  switch (request) {
    case 'setProxy':
      Extension.proxy.setProxy().then((proxySet) => {
        sendResponse(proxySet)
        return true
      })
      return true
    case 'setCustomProxy':
      Extension.config.set({
        useOwnProxy: true,
        customProxyProtocol: message.payload.proxyProtocol,
        customProxyServerURI: message.payload.customProxyServer,
      }).then(() => {
        Extension.proxy.setProxy()
      })
      break
    case 'removeCustomProxy':
      Extension.proxy.removeCustomProxy().then(() => {
        Extension.proxy.setProxy()
      })
      break
    default:
      console.warn(`unknown request: ${request}`)
  }
  return undefined
}
