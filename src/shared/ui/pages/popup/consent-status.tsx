import { callBackground } from 'Background/background-rpc'
import { getMessage } from 'Background/i18n'

import { useAction, useResource } from '../../hooks/async'
import { usePageError } from '../../hooks/errors'
import consent from '../../styles/consent.module.scss'
import popup from '../../styles/popup.module.scss'

export const PopupConsentStatus = () => {
  const { value, error: readError } = useResource(
    () => callBackground('dataConsent'), ['dataConsent'],
  )
  const { error, run } = useAction()

  usePageError(error || readError)
  return <section class={consent['consent-status']} id="consentStatus"
    aria-live="polite" hidden={value === undefined || Boolean(value?.accepted)}>
    <p class={popup['text-extension']} id="consentStatusText">
      {getMessage('consentPaused')}
    </p>
    <button type="button" class={popup['default-btn']} id="reviewConsent"
      onClick={() => run(() => callBackground('openDataConsent'))}>
      {getMessage('consentReview')}
    </button>
  </section>
}
