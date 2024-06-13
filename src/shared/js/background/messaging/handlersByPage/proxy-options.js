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
        customProxyProtocol: request.proxyProtocol,
        customProxyServerURI: request.customProxyServer,
      }).then(() => {
        Extension.proxy.setProxy()
        return true
      })
      return true
    case 'removeCustomProxy':
      Extension.proxy.removeCustomProxy().then(() => {
        Extension.proxy.setProxy()
      })
      return true
    default:
      console.warn(`unknown request: ${request}`)
  }
  return true
}
