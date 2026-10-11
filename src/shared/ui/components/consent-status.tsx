import { callBackground } from 'Background/background-rpc'
import { consentAccepted } from 'Background/data-consent'
import { getMessage } from 'Background/i18n'

import { useAction, useResource } from '../hooks/async'
import { usePageError } from '../hooks/errors'
import consent from '../styles/consent.module.scss'
import settings from '../styles/options.module.scss'
import popup from '../styles/popup.module.scss'
import { Button } from './button'

export const ConsentStatus = ({ variant = 'settings' }: {
  variant?: 'settings' | 'advanced' | 'popup'
}) => {
  const { value, error: readError, refresh } = useResource(
    () => callBackground('dataConsent'), ['dataConsent'],
  )
  const { busy, error, run } = useAction()

  usePageError(error || readError)
  const accepted = consentAccepted(value)
  const review = () => callBackground('openDataConsent')
  const advanced = variant === 'advanced'
  let sectionClass = consent['consent-status']
  let textClass = settings.disclaimer__text

  if (advanced) {
    sectionClass += ` ${settings.option} ${settings['settings-section']}`
    textClass = settings['main-page__about']
  } else if (variant === 'settings') {
    sectionClass += ` ${settings['options-page-card']}`
  } else {
    textClass = popup['text-extension']
  }
  const buttons = <>
    <Button id="reviewConsent" onClick={review}>
      {getMessage('consentReview')}
    </Button>
    {advanced && <Button id="revokeConsent" variant="light"
      hidden={!accepted} disabled={busy} onClick={() => run(async () => {
        await callBackground('setDataConsent', false)
        await refresh()
      })}>{getMessage('consentRevoke')}</Button>}
  </>

  return <section class={sectionClass} id="consentStatus" aria-live="polite"
    hidden={value === undefined || (accepted && !advanced)}>
    <p class={textClass} id="consentStatusText">
      {getMessage(accepted ? 'consentGranted' : 'consentPaused')}
    </p>
    {variant === 'popup' && <button type="button" class={popup['default-btn']}
      id="reviewConsent" onClick={review}>{getMessage('consentReview')}</button>}
    {advanced && <div class={settings['settings-actions']}>{buttons}</div>}
    {variant === 'settings' && buttons}
  </section>
}
