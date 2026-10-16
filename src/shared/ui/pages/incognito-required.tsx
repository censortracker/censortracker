import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'

import button from '../components/button.module.scss'
import { RichMessage } from '../components/message'
import { PageError } from '../components/page-error'
import { BackToPopup, PopupLayout } from '../components/popup-layout'
import { PrivateBrowsingStatus } from '../components/private-browsing-status'
import { useAction } from '../hooks/async'
import { usePageError } from '../hooks/errors'
import { useKeySequence } from '../hooks/key-sequence'
import { openIncognitoHelp, usePrivateBrowsing } from '../hooks/private-browsing'
import { navigate } from '../navigation'
import type { PageView } from '../routes'
import styles from '../styles/popup.module.scss'

// This legacy tab has no stylesheet. Keep its document rendering unchanged.
const IncognitoTab = () => {
  useKeySequence()
  const { allowed, busy, failure, status, confirm } = usePrivateBrowsing()
  const { error, run } = useAction()

  usePageError(error)
  return <div>
    <PageError />
    <div>{getMessage('unavailablePageTitle') || 'Censor Tracker'}</div>
    <div>
      <div><img src="images/icons/512x512/blocked.png" width="128px" height="128px" alt="Blocked" /></div>
      <div>
        <div id="privateBrowsingPermissionsRequiredMessage" hidden={allowed === true}>
          <div>{getMessage('incognitoAccessRequiredTitle')}</div>
          <RichMessage as="div" message="incognitoAccessRequiredDescription" />
        </div>
        <PrivateBrowsingStatus failure={failure} status={status} />
        <div>
          <button type="button" id="howToGrantIncognitoAccess" onClick={() => run(openIncognitoHelp)}>
            <span>{getMessage('howToGrantIncognitoAccessBtnTitle')}</span>
          </button>{' '}
          <button type="button" id="grantPrivateBrowsingPermissionsButton" disabled={busy}
            hidden={allowed === true} onClick={confirm}>{getMessage('grantPrivateBrowsingPermissions')}</button>{' '}
          <button type="button" id="closeTab" onClick={() => run(async () => {
            const [tab] = await browser.tabs.query({
              active: true, lastFocusedWindow: true,
            })

            if (tab?.id !== undefined) {
              await browser.tabs.remove(tab.id)
            }
          })}>
            <span>{getMessage('closeTab')}</span>
          </button>
        </div>
      </div>
    </div>
  </div>
}

const IncognitoPopup = () => {
  useKeySequence()
  const { allowed, busy, failure, status, confirm } =
    usePrivateBrowsing(() => navigate('/popup.html'))
  const { error, run } = useAction()

  usePageError(error)
  return <PopupLayout>
    <div class={styles['main-page__another-extension']}>
      <BackToPopup />
      <div>
        <div id="privateBrowsingPermissionsRequiredMessage" hidden={allowed === true}>
          <div class={`${styles['title-extension']} ${styles['title-disabled']}`}>{getMessage('privateBrowsingRequired')}</div>
          <div class={styles['text-extension']}>{getMessage('privateBrowsingRequiredDesc')}</div>
        </div>
        <PrivateBrowsingStatus failure={failure} status={status} />
        <button type="button" id="howToGrantIncognitoAccess"
          class={`${styles['default-btn']} ${styles['help-btn']} ${button.plain} ${button['plain-block']}`}
          onClick={() => run(openIncognitoHelp)}>
          <span>{getMessage('howToGrantIncognitoAccess')}</span>
        </button>
        <div class={`${styles['text-extension']} ${styles['center-text']}`}>
          <button type="button" class={`${styles['default-btn']} ${styles['block-btn']}`} id="grantPrivateBrowsingPermissionsButton"
            disabled={busy} hidden={allowed === true} onClick={confirm}>{getMessage('grantPrivateBrowsingPermissions')}</button>
        </div>
      </div>
    </div>
  </PopupLayout>
}

export const popup: PageView = {
  component: IncognitoPopup, bodyClass: styles.document ?? '',
}
export const tab: PageView = { component: IncognitoTab, bodyClass: '' }
