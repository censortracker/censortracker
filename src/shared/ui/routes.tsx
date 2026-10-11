import type { ComponentType } from 'preact'

import { AdvancedOptionsPage } from './pages/advanced-options'
import { AnimationPage } from './pages/animation'
import animation from './pages/animation/animation.module.scss'
import { ConsentPage } from './pages/consent'
import { ControlledPage } from './pages/controlled'
import { DomainRulesPage } from './pages/domain-rules'
import { IncognitoPage } from './pages/incognito-required'
import { InstalledPage } from './pages/installed'
import { NotificationsPage } from './pages/notifications'
import { OptionsPage } from './pages/options'
import { PopupPage } from './pages/popup'
import { ProxyOptionsPage } from './pages/proxy-options'
import { RegistryPage } from './pages/registry'
import upload from './styles/domain-import.module.scss'
import options from './styles/options.module.scss'
import popup from './styles/popup.module.scss'

export interface PageRoute {
  path: string
  component: ComponentType
  bodyClass: string
  title?: string | null
  language?: string
  firefox?: boolean
}

const settings = `${options.document} ${options['settings-page']}`
const main = `${options.document} ${options['options-body']}`

export const pageRoutes: PageRoute[] = [
  { path: '/popup.html', component: PopupPage, bodyClass: popup.document },
  {
    path: '/options.html',
    component: OptionsPage,
    bodyClass: main,
    title: 'optionsPageTitle',
  },
  {
    path: '/consent.html',
    component: ConsentPage,
    bodyClass: main,
    title: 'consentTitle',
    language: 'en',
  },
  {
    path: '/notifications.html',
    component: NotificationsPage,
    bodyClass: main,
    language: 'en',
  },
  {
    path: '/proxy-options.html',
    component: ProxyOptionsPage,
    bodyClass: settings,
    title: 'optionsProxyPageTitle',
  },
  {
    path: '/registry.html',
    component: RegistryPage,
    bodyClass: settings,
    title: 'optionsRegistryPageTitle',
  },
  {
    path: '/proxy-list.html',
    component: () => <DomainRulesPage />,
    bodyClass: `${options.document} ${upload.proxied}`,
    title: 'proxiedWebsitesTitle',
  },
  {
    path: '/ignore-list.html',
    component: () => <DomainRulesPage ignored />,
    bodyClass: `${options.document} `,
    title: 'ignoreEditorPageTitle',
  },
  {
    path: '/advanced-options.html',
    component: AdvancedOptionsPage,
    bodyClass: settings,
    title: 'advancedOptionsPageTitle',
  },
  {
    path: '/controlled.html',
    component: ControlledPage,
    bodyClass: popup.document,
  },
  {
    path: '/installed.html',
    component: InstalledPage,
    bodyClass: options.document,
    title: 'installedPageTitle',
  },
  {
    path: '/animation.html',
    component: AnimationPage,
    bodyClass: animation.document,
    language: 'en',
  },
  {
    path: '/incognito-required-popup.html',
    component: () => <IncognitoPage />,
    bodyClass: popup.document,
    title: null,
    firefox: true,
  },
  {
    path: '/incognito-required-tab.html',
    component: () => <IncognitoPage tab />,
    bodyClass: '',
    title: 'incognitoRequiredPageTitle',
    firefox: true,
  },
]
