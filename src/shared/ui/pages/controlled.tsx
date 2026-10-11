import { Conflicts } from '../components/conflicts'
import { BackIcon } from '../components/icons'
import { PopupLayout } from '../components/popup-layout'
import { useKeySequence } from '../hooks/key-sequence'
import { navigate } from '../navigation'
import styles from '../styles/popup.module.scss'

export const ControlledPage = () => {
  useKeySequence()
  return <PopupLayout>
    <div class={styles['main-page__another-extension']}>
      <div class={styles.icon__back} id="backToPopup"
        onClick={() => {
          navigate('/popup.html')
        }}><BackIcon /></div>
      <Conflicts compact />
    </div>
  </PopupLayout>
}
