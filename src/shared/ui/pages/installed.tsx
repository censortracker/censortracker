import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'

import { Button } from '../components/button'
import { detach, useResource } from '../hooks/async'
import { useKeySequence } from '../hooks/key-sequence'
import { openIncognitoHelp } from '../hooks/private-browsing'
import type { PageView } from '../routes'
import styles from '../styles/options.module.scss'

export const InstalledPage = () => {
  useKeySequence()
  // Inline SVG keeps the artwork rendering and its animation controls.
  const { value: art } = useResource(async () => browser.isFirefox ? ''
    : (await fetch('images/settings/instruction.svg')).text())
  const picture = <img src="images/settings/quokka.png" width="200px" height="200px" alt="Quokka Image" />

  return <div class={`${styles['main-container']} ${styles['main-container__after-install']}`}>
    <div class={styles['main-page']}>
      <div class={styles['main-page__info']}>
        <div class={styles['main-page__title']}>
          {getMessage(browser.isFirefox ? 'installedAllowIncognitoTitle' : 'thankYou')}
        </div>
        <div class={styles['main-page__content']}>
          {getMessage(browser.isFirefox ? 'installedAllowIncognitoDescription' : 'extensionInstalledDesc')}
        </div>
        {browser.isFirefox && <>
          <div class={`${styles['main-page__content']} ${styles['mt-filler']}`}>
            {getMessage('installedAllowIncognitoDescriptionThen')}
          </div>
          <Button class={styles['mt-4']} id="howToGrantIncognitoAccess"
            onClick={() => detach(openIncognitoHelp())}>
            <span class={styles.btn__text}>{getMessage('howToGrantIncognitoAccessBtnTitle')}</span>
          </Button>
        </>}
      </div>
      <div class={styles['main-page__image']}>
        {browser.isFirefox ? <a href="/options.html">{picture}</a> : picture}
      </div>
    </div>
    {!browser.isFirefox && <div class={styles.instruction}
      dangerouslySetInnerHTML={{ __html: art ?? '' }} />}
  </div>
}

export const page: PageView = {
  component: InstalledPage, bodyClass: styles.document ?? '',
}
