import { getMessage } from 'Background/i18n'
import type { ComponentChildren, DetailsHTMLAttributes } from 'preact'

import styles from '../styles/options.module.scss'
import cardStyles from './card.module.scss'
import componentStyles from './form.module.scss'

interface SectionProps extends DetailsHTMLAttributes<HTMLDetailsElement> {
  title: string
  summaryId?: string
}

export const SettingsSection = ({
  title, summaryId, children, class: className = componentStyles['settings-section'], ...props
}: SectionProps) => <details class={className} {...props}>
  <summary id={summaryId}>{getMessage(title)}</summary>
  {children}
</details>

export const Card = ({ title, children }: {
  title: string
  children: ComponentChildren
}) => <div class={cardStyles['options-page-card']}>
  <div class={styles.block__title}>{getMessage(title)}</div>
  <div class={styles['options-hr']} />
  {children}
</div>

export const Toggle = ({ id, title, checked, onChange, disabled = false }: {
  id: string
  title: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) => <div class={styles['main-page__turn']}>
  <label for={id} class={componentStyles['toggle-text']}>{getMessage(title)}</label>
  <input id={id} type="checkbox" class={componentStyles['toggle-button']}
    checked={checked} disabled={disabled}
    onChange={(event) => onChange(event.currentTarget.checked)} />
</div>

export const Field = ({ id, title, children }: {
  id: string
  title: string
  children: ComponentChildren
}) => <div class={componentStyles['settings-field']}>
  <label for={id}>{getMessage(title)}</label>
  {children}
</div>

export const Check = ({ id, title, checked, disabled = false, onChange }: {
  id: string
  title: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}) => <label class={componentStyles['settings-check']}>
  <input id={id} type="checkbox" checked={checked} disabled={disabled}
    onChange={(event) => onChange(event.currentTarget.checked)} />
  <span>{getMessage(title)}</span>
</label>
