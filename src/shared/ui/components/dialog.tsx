import { getMessage } from 'Background/i18n'
import type { ComponentChildren } from 'preact'
import { useLayoutEffect } from 'preact/hooks'

import { useLatest } from '../hooks/async'
import styles from '../styles/options.module.scss'
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
  const close = useLatest(onClose)

  useLayoutEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close.current()
      }
    }

    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [])
  return <div id={id}
    class={`${componentStyles.popup} ${open ? componentStyles['popup-show'] : ''}`}>
    <div class={componentStyles['popup-content']}>
      <div class={componentStyles['close-popup']} id={closeId} onClick={onClose}>
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none"
          xmlns="http://www.w3.org/2000/svg">
          <path d="M10 10L34 34M34 10L10 34" stroke-opacity="0.5" stroke-width="2" />
        </svg>
      </div>
      <div class={`${styles['main-page__title']} ${componentStyles['popup-title']}`}>
        {getMessage(title)}
      </div>
      {children}
    </div>
  </div>
}
