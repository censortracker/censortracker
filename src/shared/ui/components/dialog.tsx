import { getMessage } from 'Background/i18n'
import type { ComponentChildren } from 'preact'

import { useEscape } from '../hooks/escape'
import styles from '../styles/options.module.scss'
import button from './button.module.scss'
import componentStyles from './dialog.module.scss'

export const Dialog = ({
  id, closeId, open, onClose, title, children,
}: {
  id: string
  closeId: string
  open: boolean
  onClose: () => void
  title: string
  children: ComponentChildren
}) => {
  useEscape(open, onClose)
  return <div id={id} role="dialog" aria-modal="true" aria-labelledby={`${id}Title`}
    class={`${componentStyles.popup} ${open ? componentStyles['popup-show'] : ''}`}>
    <div class={componentStyles['popup-content']}>
      <button type="button" id={closeId} aria-label={getMessage('close')}
        class={`${componentStyles['close-popup']} ${button.plain}`} onClick={onClose}>
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none"
          xmlns="http://www.w3.org/2000/svg">
          <path d="M10 10L34 34M34 10L10 34" stroke-opacity="0.5" stroke-width="2" />
        </svg>
      </button>
      <div id={`${id}Title`}
        class={`${styles['main-page__title']} ${componentStyles['popup-title']}`}>
        {getMessage(title)}
      </div>
      {children}
    </div>
  </div>
}
