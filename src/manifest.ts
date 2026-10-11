import type { UserManifest } from 'wxt'

export const browserTargets = ['chrome108', 'firefox91']

export const extensionManifest = (
  browser: string, modern = false,
): UserManifest => ({
  name: '__MSG_appName__',
  description: '__MSG_appDesc__',
  default_locale: 'en',
  homepage_url: 'https://censortracker.org/',
  icons: {
    16: 'images/icons/16x16/default.png',
    48: 'images/icons/48x48/default.png',
    128: 'images/icons/128x128/default.png',
  },
  ...(browser === 'firefox' ? {
    browser_specific_settings: {
      gecko: {
        strict_min_version: modern ? '140.0' : '91.1.0',
        ...(modern ? {
          data_collection_permissions: {
            required: ['authenticationInfo', 'browsingActivity',
              'websiteContent', 'locationInfo'],
          },
        } : {}),
      },
    },
    browser_action: { default_icon: 'images/icons/128x128/default.png' },
    content_security_policy: {
      extension_pages: 'script-src \'self\'; object-src \'self\';',
    },
    permissions: ['<all_urls>', 'webRequest', 'webRequestBlocking', 'alarms',
      'activeTab', 'management', 'notifications', 'proxy', 'storage', 'tabs',
      'unlimitedStorage'],
  } : {
    minimum_chrome_version: '108',
    host_permissions: ['<all_urls>'],
    action: {
      default_icon: 'images/icons/128x128/default.png',
    },
    permissions: ['alarms', 'activeTab', 'management', 'notifications', 'proxy',
      'scripting', 'storage', 'unlimitedStorage', 'webNavigation', 'webRequest',
      'webRequestAuthProvider'],
    content_security_policy: {
      extension_pages: 'object-src \'self\'; script-src \'self\';',
    },
  }),
})
