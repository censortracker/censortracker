import browser from 'Background/browser-api'
import { CONSENT_VERSION, getDataConsent } from 'Background/data-consent'

import { SettingsLayout } from '../components/layout'
import { Notices } from '../components/notices'
import { useKeySequence } from '../hooks/key-sequence'
import { navigate } from '../navigation'

const onEmpty = async () => {
  if (!await getDataConsent()) {
    await browser.storage.local.set({ consentPromptVersion: CONSENT_VERSION })
    navigate('/consent.html', true)
  } else {
    window.close()
  }
}

export const NotificationsPage = () => {
  useKeySequence()
  return <SettingsLayout consentPage>
    <Notices onEmpty={onEmpty} />
  </SettingsLayout>
}
