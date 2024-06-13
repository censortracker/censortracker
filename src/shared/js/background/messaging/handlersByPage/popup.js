import { Extension } from '../../../extension'

export const handlePopupMessage = (message, _sender, sendResponse) => {
  const { request, payload } = message

  switch (request) {
    case 'processHostName':
      Extension.processHostName(payload.url).then(
        (status) => {
          sendResponse(status)
          return true
        },
      )
      return true
    case 'changeIgnoredStatus':
      (async () => {
        const { url, newState } = payload

        if (newState === 'always' || newState === 'auto') {
          await Extension.ignoredDomains.remove(url)
          await Extension.registry.remove(url)
        } else { // newState === 'never'
          await Extension.ignoredDomains.add(url)
          await Extension.registry.remove(url)
        }
      })()
      return true
    case 'getDomains':
      Extension.registry.getDomains().then(
        (domains) => {
          sendResponse(domains)
          return true
        },
      )
      return true
    case 'isRegistryEmpty':
      Extension.registry.isEmpty().then(
        (isEmpty) => {
          sendResponse(isEmpty)
          return true
        },
      )
      return true
    default:
      console.warn(`unknown request: ${request}`)
  }
  return true
}
