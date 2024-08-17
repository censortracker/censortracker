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
    })
    return true
  }

  // message.type === 'stateFetch'
  switch (source) {
    case 'advanced-options':
      return handleAdvancedOptionsMessage(message, _sender, sendResponse)
    case 'controlled':
      return handleControlledMessage(message, _sender, sendResponse)
    case 'options':
      return handleOptionsMessage(message, _sender, sendResponse)
    case 'popup':
      return handlePopupMessage(message, _sender, sendResponse)
    case 'proxy-options':
      return handleProxyOptionsMessage(message, _sender, sendResponse)
    case 'registry-options':
      return handleRegistryOptionsMessage(message, _sender, sendResponse)
    case 'rules-editor':
      return handleRulesMessage(message, _sender, sendResponse)
    default:
      console.warn(`unknown source: ${source}`)
  }
  return undefined
}
