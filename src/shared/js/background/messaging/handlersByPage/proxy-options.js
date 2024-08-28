import { Extension } from '../../../extension'
import ConfigManager from '../../../extension/base/config'

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
        customProxyUsername: message.payload.username,
        customProxyPassword: message.payload.password,
      }).then(() => {
        Extension.proxy.setProxy()
      })
      break
    case 'setPremiumProxy':
      (async () => {
        try {
          const passedData = JSON.parse(atob(message.payload.configString))
          const requiredKeys = ['serverURI', 'username', 'password', 'backendURL', 'signature']
          const passedKeys = Object.keys(passedData)

          if (!requiredKeys.every((key) => passedKeys.includes(key))) {
            sendResponse({ err: 'invalid data provided' })
            return
          }

          const {
            serverURI: premiumProxyServerURI,
            username: premiumUsername,
            password: premiumPassword,
            backendURL: premiumBackendURL,
            signature: premiumIdentificationCode,
          } = passedData

          // TODO: ping backend to get expiration date
          const premiumExpirationDate = Date.now() + (30 * (24 * 60 * 60 * 1000))

          await ConfigManager.set({
            usePremiumProxy: true,
            premiumProxyServerURI,
            premiumUsername,
            premiumPassword,
            premiumBackendURL,
            premiumIdentificationCode,
            premiumExpirationDate,
          })
          await Extension.proxy.setProxy()
          sendResponse({ res: { premiumIdentificationCode, premiumExpirationDate } })
          return
        } catch {
          sendResponse({ err: 'parse json error' })
        }
      })()
      return true
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
