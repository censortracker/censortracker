import { Extension } from '../../../extension'

export const handleControlledMessage = (
  message,
  _sender,
  sendResponse) => {
  const { request } = message

  switch (request) {
    case 'takeControl':
      (async () => {
        await Extension.proxy.takeControl()
        await Extension.proxy.setProxy()
        return true
      })()
      return true
    case 'controlledByThisExtension':
      Extension.proxy.controlledByThisExtension().then(
        (controlledByThisExtension) => {
          sendResponse(controlledByThisExtension)
          return true
        },
      )
      return true
    case 'controlledByOtherExtensions':
      Extension.proxy.controlledByOtherExtensions().then(
        (controlledByOtherExtensions) => {
          sendResponse(controlledByOtherExtensions)
          return true
        },
      )
      return true
    default:
      console.warn(`unknown request: ${request}`)
  }
  return true
}
