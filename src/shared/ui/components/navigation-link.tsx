import { getMessage } from 'Background/i18n'
import type { ComponentChildren } from 'preact'

import styles from '../styles/options.module.scss'
import { ArrowIcon } from './icons'
import componentStyles from './navigation-link.module.scss'

export const NavigationLink = ({
  id, groupId, href, title, description, children, grouped = true,
}: {
  id: string
  groupId: string
  href: string
  title: string
  description: string
  children?: ComponentChildren
  grouped?: boolean
}) => <div class={grouped ? componentStyles.checkbox__group : ''} id={groupId}>
  <a id={id} href={href}
    class={`${componentStyles['main-page__link']} ${componentStyles['link-ignored']}`}>
    <span>{getMessage(title)}</span>
    {children}
    <span><ArrowIcon /></span>
  </a>
  <div class={styles['main-page__about']}>{getMessage(description)}</div>
</div>
