import { Extension } from '../../../extension'

export const handleAdvancedOptionsMessage = (
  message,
  _sender,
  sendResponse) => {
  const { request } = message

  switch (request) {
    case 'getDebugInfo':
      Extension.config.getDebugInfo().then(
        (data) => {
          sendResponse(data)
          return true
        },
      )
      return true
    case 'exportSettings':
      Extension.config.exportSettings().then(
        (settings) => {
          sendResponse(settings)
          return true
        },
      )
      return true
    default:
      console.warn(`unknown request: ${request}`)
  }
  return true
}
