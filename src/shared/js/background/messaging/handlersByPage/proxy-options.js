import { Extension } from '../../../extension'
import ConfigManager from '../../../extension/base/config'
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
          premiumBackendURL,
          premiumIdentificationCode,
        })

        const actualConfig = await checkPremiumBackend(premiumBackendURL, premiumIdentificationCode)

        if (!actualConfig) {
          await ConfigManager.set({
            premiumBackendUnreachable: true,
          })
          await ConfigManager.set({
            usePremiumProxy: true,
            haveActivePremiumConfig: true,
            premiumProxyServerURI,
            premiumUsername,
            premiumPassword,
            premiumBackendURL,
          })
          await Extension.proxy.setProxy()

          sendResponse({
            res: {
              premiumIdentificationCode,
            },
            err: 'serverInavalidResponse',
          })
          return
        }

        sendResponse({
          res: {
            premiumIdentificationCode,
            premiumExpirationDate: actualConfig.expirationDate,
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
    case 'enablePremiumProxy':
      (async () => {
        const isPremiumExpired = await Extension.proxy.monitorPremiumExpiration()

        if (!isPremiumExpired) {
          await ConfigManager.set({
            usePremiumProxy: true,
          })
        }
        sendResponse({ hasNotExpired: !isPremiumExpired })
      })()
      return true
    case 'disablePremiumProxy':
      (async () => {
        await ConfigManager.set({
          usePremiumProxy: false,
        })
        await Extension.proxy.setProxy()
      })()
      console.log('!!!!!!!!!')
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
