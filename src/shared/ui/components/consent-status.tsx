import { callBackground } from 'Background/background-rpc'
import { getMessage } from 'Background/i18n'

import { useAction, useResource } from '../hooks/async'
import { usePageError } from '../hooks/errors'
import consent from '../styles/consent.module.scss'
import settings from '../styles/options.module.scss'
import { Button } from './button'

export const ConsentStatus = ({ advanced = false }: { advanced?: boolean }) => {
  const { value, error: readError, refresh } = useResource(
    () => callBackground('dataConsent'), ['dataConsent'],
  )
  const { busy, error, run } = useAction()

  usePageError(error || readError)
  const accepted = Boolean(value?.accepted)
  const review = () => run(() => callBackground('openDataConsent'))
  const buttons = <>
    <Button id="reviewConsent" onClick={review}>
      {getMessage('consentReview')}
    </Button>
    {advanced && <Button id="revokeConsent" variant="light"
      hidden={!accepted} disabled={busy} onClick={() => run(
        () => callBackground('setDataConsent', false), refresh,
      )}>{getMessage('consentRevoke')}</Button>}
  </>

  return <section id="consentStatus" aria-live="polite"
    class={`${consent['consent-status']} ${advanced
      ? `${settings.option} ${settings['settings-section']}`
      : settings['options-page-card']}`}
    hidden={value === undefined || (accepted && !advanced)}>
    <p class={advanced ? settings['main-page__about'] : settings.disclaimer__text}
      id="consentStatusText">
      {getMessage(accepted ? 'consentGranted' : 'consentPaused')}
    </p>
    {advanced ? <div class={settings['settings-actions']}>{buttons}</div> : buttons}
  </section>
}
