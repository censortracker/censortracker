import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'

import notice from '../../components/notice.module.scss'
import { PrivateBrowsingStatus } from '../../components/private-browsing-status'
import { usePrivateBrowsing } from '../../hooks/private-browsing'
import settings from '../../styles/options.module.scss'

export const PrivateBrowsing = ({ onSuccess }: {
  onSuccess: () => unknown
}) => {
  const { allowed, busy, failure, status, confirm } =
    usePrivateBrowsing(onSuccess)

  return <>
    <div class={`${notice['main-page__extension']} ${settings['private-browsing-message']}`}
      id="privateBrowsingPermissionsRequiredMessage" hidden={allowed !== false}>
      <div class={notice.extension__title}>{getMessage('privateBrowsingRequired')}</div>
      <div class={settings.extension__text}>{getMessage('privateBrowsingRequiredDesc')}</div>
      <a id="howToGrantIncognitoAccess" class={notice['default-btn']}
        href={getMessage('howToGrantIncognitoAccessLink')} target="_blank"
        rel="noreferrer">{getMessage('howToGrantIncognitoAccess')}</a>
    </div>
    {browser.isFirefox &&
      <PrivateBrowsingStatus failure={failure} status={status} />}
    <button type="button" class={`${notice['default-btn']} ${settings['grant-button']}`}
      hidden={allowed !== false} disabled={busy}
      id="grantPrivateBrowsingPermissionsButton" onClick={confirm}>
      {getMessage('grantPrivateBrowsingPermissions')}
    </button>
  </>
}
