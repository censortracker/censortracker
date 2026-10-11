import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'

import { BackIcon } from '../components/icons'
import { RichMessage } from '../components/message'
import { PopupLayout } from '../components/popup-layout'
import { usePrivateBrowsing } from '../components/private-browsing'
import { useResource } from '../hooks/async'
import { useKeySequence } from '../hooks/key-sequence'
import { navigate } from '../navigation'
import styles from '../styles/popup.module.scss'

export const IncognitoPage = ({ tab = false }: { tab?: boolean }) => {
  useKeySequence()
  const { value: activeTab } = useResource(async () => {
    const [active] = await browser.tabs.query({
      active: true,
      lastFocusedWindow: true,
    })

    return active
  })
  const back = () => {
    navigate('/popup.html')
  }
  const { allowed, busy, failure, status, confirm } = usePrivateBrowsing(back)
  const help = () => browser.tabs.create({ url: getMessage('howToGrantIncognitoAccessLink') })
  const message = <p hidden={!failure && !status} role={failure ? 'alert' : 'status'}>
    {failure instanceof Error ? failure.message : status}
  </p>

  if (tab) {
    // This legacy page has no stylesheet. Keep its document rendering unchanged.
    return <div>
      <div>{getMessage('unavailablePageTitle') || 'Censor Tracker'}</div>
      <div>
        <div><img src="images/icons/512x512/blocked.png" width="128px" height="128px" alt="Blocked" /></div>
        <div>
          <div id="privateBrowsingPermissionsRequiredMessage" hidden={allowed === true}>
            <div>{getMessage('incognitoAccessRequiredTitle')}</div>
            <RichMessage as="div" message="incognitoAccessRequiredDescription" />
          </div>
          {message}
          <div>
            <button id="howToGrantIncognitoAccess" onClick={help}><span>{getMessage('howToGrantIncognitoAccessBtnTitle')}</span></button>{' '}
            <button type="button" id="grantPrivateBrowsingPermissionsButton" disabled={busy}
              hidden={allowed === true} onClick={confirm}>{getMessage('grantPrivateBrowsingPermissions')}</button>{' '}
            <button id="closeTab" onClick={() => activeTab?.id && browser.tabs.remove(activeTab.id)}>
              <span>{getMessage('closeTab')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  }
  return <PopupLayout>
    <div class={styles['main-page__another-extension']}>
      <div class={styles.icon__back} id="backToPopup" onClick={back}><BackIcon /></div>
      <div>
        <div id="privateBrowsingPermissionsRequiredMessage" hidden={allowed === true}>
          <div class={`${styles['title-extension']} ${styles['title-disabled']}`}>{getMessage('privateBrowsingRequired')}</div>
          <div class={styles['text-extension']}>{getMessage('privateBrowsingRequiredDesc')}</div>
        </div>
        {message}
        <div id="howToGrantIncognitoAccess" class={styles['default-btn']} onClick={help}>
          <span>{getMessage('howToGrantIncognitoAccess')}</span>
        </div>
        <div class={`${styles['text-extension']} ${styles['center-text']}`}>
          <button type="button" class={styles['default-btn']} id="grantPrivateBrowsingPermissionsButton"
            disabled={busy} hidden={allowed === true} onClick={confirm}>{getMessage('grantPrivateBrowsingPermissions')}</button>
        </div>
      </div>
    </div>
  </PopupLayout>
}
