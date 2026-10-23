import { getMessage } from 'Background/i18n'
import type { ComponentChildren } from 'preact'

import consent from '../styles/consent.module.scss'
import styles from '../styles/options.module.scss'
import { BackLink } from './icons'
import componentStyles from './layout.module.scss'
import { PageError } from './page-error'

export const settingsDocument =
  `${componentStyles.document} ${componentStyles['settings-page']}`
export const mainDocument =
  `${componentStyles.document} ${componentStyles['options-body']}`

export const SettingsHeader = ({ title, id, class: extra = styles['page-main-title'] }: {
  title: string
  id?: string
  class?: string
}) => <>
  <BackLink />
  <div id={id} class={`${styles['main-page__title']}${extra ? ` ${extra}` : ''}`}>
    {getMessage(title)}
  </div>
</>

interface Props {
  children: ComponentChildren
  after?: ComponentChildren
  consentPage?: boolean
  linkedImage?: boolean
  imageLinkClass?: string
}

export const SettingsLayout = ({
  children, after, consentPage = false, linkedImage = false, imageLinkClass,
}: Props) => {
  const picture = <img src="images/settings/quokka.png"
    width="200" height="200" alt={linkedImage ? 'Censor Tracker Logo' : ''} />

  return <div class={componentStyles['main-container']}>
    <div class={`${componentStyles['main-page']} ${consentPage ? consent['consent-page'] : ''}`}>
      <div class={componentStyles['main-page__image']}>
        {linkedImage ? <a href="/options.html" class={imageLinkClass}>
          {picture}
        </a> : picture}
      </div>
      <main class={componentStyles['main-page__info']}><PageError />{children}</main>
    </div>
    {after}
  </div>
}
