import type { ComponentType } from 'preact'

export interface PageView {
  component: ComponentType
  bodyClass: string
}

export interface PageRoute {
  path: string
  // Each page loads its own code and styles.
  load: () => Promise<PageView>
  title?: string | null
  firefox?: boolean
}

export const pageRoutes: PageRoute[] = [
  {
    path: '/popup.html',
    load: async () => (await import('./pages/popup')).page,
  },
  {
    path: '/options.html',
    load: async () => (await import('./pages/options')).page,
    title: 'optionsPageTitle',
  },
  {
    path: '/consent.html',
    load: async () => (await import('./pages/consent')).page,
    title: 'consentTitle',
  },
  {
    path: '/notifications.html',
    load: async () => (await import('./pages/notifications')).page,
  },
  {
    path: '/proxy-options.html',
    load: async () => (await import('./pages/proxy-options')).page,
    title: 'optionsProxyPageTitle',
  },
  {
    path: '/registry.html',
    load: async () => (await import('./pages/registry')).page,
    title: 'optionsRegistryPageTitle',
  },
  {
    path: '/proxy-list.html',
    load: async () => (await import('./pages/domain-rules')).proxied,
    title: 'proxiedWebsitesTitle',
  },
  {
    path: '/ignore-list.html',
    load: async () => (await import('./pages/domain-rules')).ignored,
    title: 'ignoreEditorPageTitle',
  },
  {
    path: '/advanced-options.html',
    load: async () => (await import('./pages/advanced-options')).page,
    title: 'advancedOptionsPageTitle',
  },
  {
    path: '/controlled.html',
    load: async () => (await import('./pages/controlled')).page,
  },
  {
    path: '/installed.html',
    load: async () => (await import('./pages/installed')).page,
    title: 'installedPageTitle',
  },
  {
    path: '/animation.html',
    load: async () => (await import('./pages/animation')).page,
  },
  {
    path: '/incognito-required-popup.html',
    load: async () => (await import('./pages/incognito-required')).popup,
    title: null,
    firefox: true,
  },
  {
    path: '/incognito-required-tab.html',
    load: async () => (await import('./pages/incognito-required')).tab,
    title: 'incognitoRequiredPageTitle',
    firefox: true,
  },
]
