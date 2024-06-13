import { Extension } from '../../../extension'

export const handleRulesMessage = (
  message,
  _sender,
  sendResponse) => {
  const { request, payload } = message

  switch (request) {
    case 'getIgnoredDomains':
      Extension.ignoredDomains.getAll().then((ignoredHosts) => {
        sendResponse(ignoredHosts)
        return true
      })
      return true
    case 'setIgnoredDomains':
      Extension.ignoredDomains.set(payload.domains)
      return true
    case 'setCustomProxiedDomains':
      Extension.config.set({
        customProxiedDomains: payload.domains,
      })
      return true
    default:
      console.warn(`unknown request: ${request}`)
  }
  return true
}
