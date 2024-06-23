import { configService, Extension } from '../../extension'
import { handleAdvancedOptionsMessage } from './handlersByPage/advanced-options'
import { handleControlledMessage } from './handlersByPage/controlled'
import { handleOptionsMessage } from './handlersByPage/options'
import { handlePopupMessage } from './handlersByPage/popup'
import { handleProxyOptionsMessage } from './handlersByPage/proxy-options'
import { handleRegistryOptionsMessage } from './handlersByPage/registry-options'
import { handleRulesMessage } from './handlersByPage/rules-editor'

// type Message = {
//   type: 'transition' | 'dataFetch' | 'stateFetch'
//   source: 'popup' | '' | ...
//   request: string | string[]
//   payload: string | undefined
// }

export const handleMessage = (message, _sender, sendResponse) => {
  const { type: messageType, request, source } = message

  if (messageType === 'transition') {
    configService.send({ type: request, settings: message?.payload?.settings })
    return undefined
  }
  if (messageType === 'dataFetch') {
    Extension.config.get(...request).then((data) => {
      sendResponse(data)
      return true
    })
    return true
  }

  // message.type === 'stateFetch'
  switch (source) {
    case 'advanced-options':
      handleAdvancedOptionsMessage(message, _sender, sendResponse)
      return true
    case 'controlled':
      handleControlledMessage(message, _sender, sendResponse)
      return true
    case 'options':
      handleOptionsMessage(message, _sender, sendResponse)
      return true
    case 'popup':
      handlePopupMessage(message, _sender, sendResponse)
      return true
    case 'proxy-options':
      handleProxyOptionsMessage(message, _sender, sendResponse)
      return true
    case 'registry-options':
      handleRegistryOptionsMessage(message, _sender, sendResponse)
      return true
    case 'rules-editor':
      handleRulesMessage(message, _sender, sendResponse)
      return true
    default:
      console.warn(`unknown source: ${source}`)
  }
  return true
}
