import { callBackground } from 'Background/background-rpc'
import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'

import { Button } from '../components/button'
import { mainDocument, SettingsLayout } from '../components/layout'
import { useAction } from '../hooks/async'
import { navigate } from '../navigation'
import type { PageView } from '../routes'
import consentStyles from '../styles/consent.module.scss'
import styles from '../styles/options.module.scss'

const REPOSITORY_URL = 'https://github.com/censortracker/censortracker'

export const ConsentPage = () => {
  const { busy, error, run } = useAction()
  const consent = (accepted: boolean) => run(async () => {
    await callBackground('setDataConsent', accepted)
    navigate('/options.html')
  })

  return <SettingsLayout consentPage>
    <h1 class={styles['main-page__title']}>{getMessage('consentTitle')}</h1>
    <section class={styles['options-page-card']} aria-labelledby="consentSummaryTitle">
      <h2 class={styles.block__title} id="consentSummaryTitle">TL;DR</h2>
      {['consentSummary', 'consentSummaryDecline'].map((key, index) =>
        <div class={consentStyles['consent-summary-row']} key={key}>
          <img src={`images/popup/${index ? 'danger' : 'default'}.png`}
            width="64" height="64" alt="" />
          <p class={styles.disclaimer__text}>{getMessage(key)}</p>
        </div>)}
    </section>
    <section class={styles['options-page-card']}>
      <p class={styles.disclaimer__text}>{getMessage('consentIntro')}</p>
      <h2 class={styles.block__title}>{getMessage('consentDetails')}</h2>
      <ul class={styles.disclaimer__text}>
        {['Traffic', 'Services', 'Checks', 'Sources'].map((key) =>
          <li key={key}>{getMessage(`consent${key}`)}</li>)}
      </ul>
      <p class={styles.disclaimer__text}>{getMessage('consentLocal')}</p>
      <h2 class={styles.block__title}>{getMessage('consentSourceTitle')}</h2>
      <p class={styles.disclaimer__text}>{getMessage('consentSourceCode')}{' '}
        <a class={consentStyles['notice-link']} href={REPOSITORY_URL} target="_blank">
          {REPOSITORY_URL}
        </a>
      </p>
    </section>
    <div class={consentStyles['consent-actions']}>
      <Button id="acceptConsent" disabled={busy} onClick={() => consent(true)}>
        {getMessage('consentAccept')}
      </Button>
      <Button id="declineConsent" variant="light" disabled={busy}
        onClick={() => consent(false)}>{getMessage('consentDecline')}</Button>
      <Button id="uninstallConsent" variant="light" disabled={busy}
        onClick={() => run(() => browser.management.uninstallSelf({
          showConfirmDialog: true,
        }))}>{getMessage('consentUninstall')}</Button>
    </div>
    <p id="consentError" role="alert">
      {error ? getMessage('operationFailed') : ''}
    </p>
  </SettingsLayout>
}

export const page: PageView = {
  component: ConsentPage, bodyClass: mainDocument,
}
