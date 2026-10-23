import { callBackground } from 'Background/background-rpc'

import { mainDocument, SettingsLayout } from '../components/layout'
import { Notices } from '../components/notices'
import { useKeySequence } from '../hooks/key-sequence'
import { navigate } from '../navigation'
import type { PageView } from '../routes'
import settings from '../styles/options.module.scss'

const onEmpty = async () => {
  if (await callBackground('consentPrompt')) {
    navigate('/consent.html', true)
  } else {
    window.close()
  }
}

export const NotificationsPage = () => {
  useKeySequence()
  return <SettingsLayout consentPage>
    <Notices onEmpty={onEmpty} classes={{
      title: settings.block__title,
      text: settings.disclaimer__text,
      button: settings['default-btn'],
    }} />
  </SettingsLayout>
}

export const page: PageView = {
  component: NotificationsPage, bodyClass: mainDocument,
}
