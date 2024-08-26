import { Extension } from '../../../extension'
import ConfigManager from '../../../extension/base/config'
import { updateDNRRules } from '../../DNR/rulesManager'

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
      ConfigManager.set({
        useOwnProxy: true,
        customProxyProtocol: message.payload.proxyProtocol,
        customProxyServerURI: message.payload.customProxyServer,
      }).then(() => {
        Extension.proxy.setProxy()
      })
      break
    // КОСТЫЛЬ
    case 'setPremiumProxy':
      (async () => {
        await ConfigManager.set({
          usePremiumProxy: true,
          premiumProxyServerURI: 'auth.ctreserve.de:45678', // message.payload.server,
          // premiumUsername: message.payload.username,
          // premiumPassword: message.payload.password,
          // premiumExpirationDate: message.payload.expirationDate,
        })
        const { usePremiumProxy, useOwnProxy } = ConfigManager.get('usePremiumProxy', 'useOwnProxy')

        console.log(usePremiumProxy, useOwnProxy)

        await Extension.proxy.setProxy()
      })()
      break
    case 'removeCustomProxy':
      Extension.proxy.removeCustomProxy().then(() => {
        Extension.proxy.setProxy()
      })
      break
    case 'updateDNRRules':
      updateDNRRules()
      break
    default:
      console.warn(`unknown request: ${request}`)
  }
  return undefined
}
