import { Extension } from '../../../extension'
import ConfigManager from '../../../extension/base/config'
// eslint-disable-next-line no-unused-vars
import { checkPremiumBackend } from '../../../extension/base/proxy/proxy'
import { processEncodedConfig } from '../../../utilities'

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
        usePremiumProxy: false,
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
        const { err, data } = processEncodedConfig(message.payload.configString)

        if (err) {
          sendResponse({ err })
          return
        }

        const {
          premiumProxyServerURI,
          premiumUsername,
          premiumPassword,
          premiumBackendURL,
          premiumIdentificationCode,
        } = data

        await ConfigManager.set({
          usePremiumProxy: true,
          haveActivePremiumConfig: true,
          premiumProxyServerURI,
          premiumUsername,
          premiumPassword,
          premiumBackendURL,
          premiumIdentificationCode,
          premiumExpirationDate: Date.now() + (30 * (24 * 60 * 60 * 1000)),
        })
        await Extension.proxy.setProxy()

        // const actualConfig = await checkPremiumBackend()

        // if (!actualConfig) {
        //   await ConfigManager.set({
        //     premiumBackendUnreachable: true,
        //   })
        //   sendResponse({
        //     res: {
        //       premiumIdentificationCode,
        //     },
        //     err: 'serverInavalidResponse',
        //   })
        //   return
        // }

        sendResponse({
          res: {
            premiumIdentificationCode,
            premiumExpirationDate: Date.now() + (30 * (24 * 60 * 60 * 1000)),
          },
        })
      })()
      return true
    case 'activatePremiumProxy':
      (async () => {
        await Extension.proxy.removeCustomProxy()
        const { haveActivePremiumConfig } = await ConfigManager.get('haveActivePremiumConfig')

        if (haveActivePremiumConfig) {
          await ConfigManager.set({
            usePremiumProxy: true,
          })
        }
      })()
      break
    case 'removeCustomProxy':
      ConfigManager.set({ usePremiumProxy: false })
      Extension.proxy.removeCustomProxy().then(() => {
        Extension.proxy.setProxy()
      })
      break
    default:
      console.warn(`unknown request: ${request}`)
  }
  return undefined
}
