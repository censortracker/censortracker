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

        if (newState === 'always') {
          Extension.ignoredDomains.remove(url).then((removed) => {
            if (removed) {
              Extension.registry.add(url).then((added) => {
                console.warn('Proxying strategy was changed to: "always"')
              })
            }
          })
        } else if (newState === 'auto') {
          await Extension.ignoredDomains.remove(url)
          await Extension.registry.remove(url)
        } else { // newState === 'never'
          await Extension.ignoredDomains.add(url)
          await Extension.registry.remove(url)
        }
      })()
      break
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
  return undefined
}
