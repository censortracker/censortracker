import { Extension } from '../../../extension'

export const handleP2pMessage = (
  message,
  _sender,
  sendResponse) => {
  // eslint-disable-next-line no-unused-vars
  const { request, payload } = message

  switch (request) {
    case 'enableBridgeMode':
      Extension.p2p.enable()
      return undefined
    default:
      console.warn(`unknown request: ${request}`)
  }
  return true
}
