import { getMessage } from 'Background/i18n'
import type { ComponentChildren } from 'preact'

import styles from '../../styles/popup.module.scss'
import componentStyles from './info-block.module.scss'

export const InfoBlock = ({
  id, title, icon = 'ok', open, onToggle, hidden, children, details,
  description, link, warning = false, route = false,
}: {
  id: string
  title: string
  icon?: string
  open: boolean
  onToggle: () => void
  hidden: boolean
  children?: ComponentChildren
  details?: ComponentChildren
  description?: string
  link?: string
  warning?: boolean
  route?: boolean
}) => <div id={id} hidden={hidden}
  class={`${componentStyles['main-page__block']} ${route ? '' : styles.unselectable}`}>
  <div class={componentStyles.block__title}>
    <span id={route ? undefined : `${id}-title`} class={route ? styles.unselectable : ''}>
      {getMessage(title)}
    </span>
    <img class={`${componentStyles.icon__status} ${route ? `${styles.unselectable}` : ''}`}
      src={`images/popup/status/${icon}.svg`} width="24px" height="24px" alt={route ? '' : 'Status'} />
  </div>
  {children}
  <div onClick={onToggle}
    class={`${componentStyles.block__btn} ${componentStyles['btn-about']} ${componentStyles['btn-what-this-mean']} ${route ? styles.unselectable : ''}`}
    style={{ display: open ? 'none' : 'flex' }}>
    <span>{getMessage(route ? 'popupProxyInfoShowDetails' : 'whatThisMean')}</span>
    <svg class={`${componentStyles.block__btn} ${styles.icon}`} width="8" height="6" viewBox="0 0 8 6" fill="none"
      xmlns="http://www.w3.org/2000/svg">
      <path d="M0.546875 1.47339L4 5.5L7.48204 1.47339" stroke="#3B332B" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </div>
  <div id={id === 'ori' ? 'ori-details' : undefined} style={{ display: open ? 'block' : 'none' }}
    class={`${componentStyles.block__text} ${componentStyles['text-normal']} ${warning ? componentStyles['text-warning'] : ''} ${route ? componentStyles['proxying-details'] : ''}`}>
    {description && <span id={`${id}-desc`}>{getMessage(description)}</span>}
    {details}
    <div class={componentStyles.block__footer}>
      <span class={`${componentStyles.block__btn} ${componentStyles['btn-ok']}`} onClick={onToggle}>
        {getMessage('okayButton')}
      </span>
      {link && <span class={`${componentStyles.block__btn} ${componentStyles['btn-text']}`}>
        <a href={link} target="_blank">{getMessage('readMoreButton')}</a>
      </span>}
    </div>
  </div>
</div>
