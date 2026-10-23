import button from '../components/button.module.scss'
import { Conflicts } from '../components/conflicts'
import { BackToPopup, PopupLayout } from '../components/popup-layout'
import { useKeySequence } from '../hooks/key-sequence'
import type { PageView } from '../routes'
import styles from '../styles/popup.module.scss'

export const ControlledPage = () => {
  useKeySequence()
  return <PopupLayout>
    <div class={styles['main-page__another-extension']}>
      <BackToPopup />
      <Conflicts compact classes={{
        title: `${styles['title-extension']} ${styles['title-disabled']}`,
        text: styles['text-extension'],
        button: `${styles['default-btn']} ${button.plain} ${button['plain-block']}`,
      }} />
    </div>
  </PopupLayout>
}

export const page: PageView = {
  component: ControlledPage, bodyClass: styles.document ?? '',
}
