import { getMessage } from 'Background/i18n'

import button from '../../components/button.module.scss'
import styles from '../../styles/popup.module.scss'
import componentStyles from './info-block.module.scss'

export type StatusIcon = 'ok' | 'danger' | 'info' | 'question'

export const statusIcon = (icon: StatusIcon) => `images/popup/status/${icon}.svg`

export const ShowDetails = ({ open, onToggle, label, class: extra = '' }: {
  open: boolean
  onToggle: () => void
  label: string
  class?: string
}) => <button type="button" onClick={onToggle}
  class={`${componentStyles.block__btn} ${componentStyles['btn-about']} ${componentStyles['btn-what-this-mean']} ${button.plain} ${button['plain-block']} ${extra}`}
  style={{ display: open ? 'none' : 'flex' }}>
  <span>{getMessage(label)}</span>
  <svg class={`${componentStyles.block__btn} ${styles.icon}`} width="8" height="6" viewBox="0 0 8 6" fill="none"
    xmlns="http://www.w3.org/2000/svg">
    <path d="M0.546875 1.47339L4 5.5L7.48204 1.47339" stroke="#3B332B" stroke-linecap="round" stroke-linejoin="round" />
  </svg>
</button>

export const HideDetails = ({ onToggle }: { onToggle: () => void }) =>
  <button type="button" onClick={onToggle}
    class={`${componentStyles.block__btn} ${componentStyles['btn-ok']} ${button.plain}`}>
    {getMessage('okayButton')}
  </button>

export const InfoBlock = ({
  id, title, icon, open, onToggle, hidden, description, link, warning = false,
}: {
  id: string
  title: string
  icon: StatusIcon
  open: boolean
  onToggle: () => void
  hidden: boolean
  description: string
  link: string
  warning?: boolean
}) => <div id={id} hidden={hidden}
  class={`${componentStyles['main-page__block']} ${styles.unselectable}`}>
  <div class={componentStyles.block__title}>
    <span id={`${id}-title`}>{getMessage(title)}</span>
    <img class={componentStyles.icon__status}
      src={statusIcon(icon)} width="24px" height="24px" alt="Status" />
  </div>
  <ShowDetails open={open} onToggle={onToggle} label="whatThisMean" />
  <div id={`${id}-details`} style={{ display: open ? 'block' : 'none' }}
    class={`${componentStyles.block__text} ${componentStyles['text-normal']} ${warning ? componentStyles['text-warning'] : ''}`}>
    <span id={`${id}-desc`}>{getMessage(description)}</span>
    <div class={componentStyles.block__footer}>
      <HideDetails onToggle={onToggle} />
      <span class={`${componentStyles.block__btn} ${componentStyles['btn-text']}`}>
        <a href={link} target="_blank">{getMessage('readMoreButton')}</a>
      </span>
    </div>
  </div>
</div>
