import type { ComponentChildren } from 'preact'

import styles from '../styles/popup.module.scss'
import componentStyles from './popup-layout.module.scss'

export const PopupLayout = ({ children, image, footer }: {
  children: ComponentChildren
  image?: ComponentChildren
  footer?: ComponentChildren
}) => <div>
  <div class={componentStyles['main-page']}>
    {image}
    <div class={styles['main-page__info']}>{children}</div>
  </div>
  {footer}
</div>
