import { callBackground } from 'Background/background-rpc'
import { getMessage } from 'Background/i18n'

export const readPopup = async () => {
  const state = await callBackground('popupState')

  if (!state.consent) {
    return state
  }
  const { hostname, valid, enabled, domain, disseminator, network } = state
  let image = 'normal'

  if (domain?.blocked) {
    image = 'blocked'
  }
  if (disseminator.url) {
    image = disseminator.cooperationRefused ? 'normal' : 'ori'
    if (domain?.blocked && disseminator.cooperationRefused === false) {
      image = 'ori_blocked'
    }
  }
  if (network) {
    image = network
  }
  if (!enabled) {
    image = 'disabled'
  }
  let fontSize: string | undefined = !valid && getMessage('popupNewTabMessage').length >= 25
    ? '15px' : undefined

  if (enabled) {
    if (hostname.length >= 22 && hostname.length < 25) {
      fontSize = '17px'
    } else if (hostname.length > 25 && hostname.length < 30) {
      fontSize = '15px'
    } else if (hostname.length >= 30) {
      fontSize = '13px'
    }
  }
  return { ...state, image, fontSize }
}
