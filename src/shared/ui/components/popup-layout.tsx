import { getMessage } from 'Background/i18n'
import type { ComponentChildren } from 'preact'

import { navigate } from '../navigation'
import styles from '../styles/popup.module.scss'
import button from './button.module.scss'
import { BackIcon } from './icons'
import { PageError } from './page-error'
import componentStyles from './popup-layout.module.scss'

export const PopupLayout = ({ children, image, footer }: {
  children: ComponentChildren
  image?: ComponentChildren
  footer?: ComponentChildren
}) => <div>
  <div class={componentStyles['main-page']}>
    {image}
    <div class={styles['main-page__info']}><PageError />{children}</div>
  </div>
  {footer}
</div>

export const BackToPopup = () => <button type="button" id="backToPopup"
  class={`${styles.icon__back} ${button.plain}`} aria-label={getMessage('back')}
  onClick={() => navigate('/popup.html')}><BackIcon /></button>
