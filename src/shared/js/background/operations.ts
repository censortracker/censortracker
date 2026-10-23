import browser from './browser-api'
import { CONSENT_VERSION, getDataConsent, hasDataConsent } from './data-consent'
import { removeDuplicates } from './hostname'
import { getMessage } from './i18n'
import ProxyManager from './proxy'
import { withProxyLock } from './proxy-route'
import Registry from './registry'
import { getRegistrySourceState, refreshRegistrySource } from './registry-source'
import { requestText } from './request'
import { synchronize } from './server'
import Settings from './settings'
import type { StorageState } from './storage'
import { isValidURL } from './utilities'
import { isRecord } from './value'

export const importSettings = (settings: unknown) => withProxyLock(async () => {
  await Settings.importSettingsInBackground(settings)
  await ProxyManager.syncLocalProxyInBackground()
  await ProxyManager.setProxyInBackground()
}).then(async () => {
  const { source } = await getRegistrySourceState()

  if (source.enabled && await hasDataConsent()) {
    await refreshRegistrySource()
  }
})

export const restoreSettings = async (settings: unknown) => {
  await importSettings(settings)
  await ProxyManager.setProxy()
  await synchronize({ syncRegistry: true })
  await ProxyManager.setProxy()
}

export const updateRegistry = async () => {
  await synchronize()
  const { serviceErrors = [] } = await browser.storage.local.get('serviceErrors')

  if (await ProxyManager.isEnabled()) {
    await ProxyManager.removeBadProxies()
    if (!await ProxyManager.setProxy()) {
      throw new Error(getMessage('proxySetupFailed'))
    }
    await ProxyManager.ping()
  }
  if (serviceErrors.length > 0) {
    throw new Error(serviceErrors.join('; '))
  }
}

export const resetSettings = async () => {
  await importSettings({ enableExtension: true })
  await ProxyManager.removeBadProxies()
  await synchronize()
  const canSetProxy = await ProxyManager.requestIncognitoAccess()

  if (canSetProxy && !await ProxyManager.setProxy()) {
    throw new Error(getMessage('proxySetupFailed'))
  }
  const { serviceErrors = [] } = await browser.storage.local.get('serviceErrors')

  if (serviceErrors.length > 0) {
    throw new Error(serviceErrors.join('; '))
  }
  if (canSetProxy) {
    await ProxyManager.ping()
  }
}

export const setRegistryEnabled = async (enabled: boolean) => {
  if (enabled) {
    await Registry.enableRegistry()
    await synchronize()
  } else {
    await Registry.disableRegistry()
  }
  await ProxyManager.setProxy()
}

export const setExtensionEnabled = async (enabled: boolean) => {
  if (enabled) {
    await Settings.enableExtension()
    await Settings.enableNotifications()
    await ProxyManager.enableProxy()
  } else {
    await Settings.disableExtension()
  }
}

export const setProxyEnabled = async (enabled: boolean) => {
  if (enabled) {
    await ProxyManager.enableProxy()
    await ProxyManager.syncLocalProxy({ startIfMissing: true })
  } else {
    await ProxyManager.disableProxy()
  }
}

// Firefox needs private browsing access before CT can set its proxy.
export const incognitoAccess = async () => {
  const { privateBrowsingPermissionsRequired } =
    await browser.storage.local.get({
      privateBrowsingPermissionsRequired: false,
    })
  const allowed = await ProxyManager.requestIncognitoAccess()

  return {
    allowed,
    restore: allowed && privateBrowsingPermissionsRequired &&
      await Settings.extensionEnabled() && await ProxyManager.isEnabled(),
  }
}

export const applyProxy = async (enable: boolean) => {
  if (enable) {
    if (!await Settings.extensionEnabled()) {
      throw new Error(getMessage('proxySetupExtensionDisabled'))
    }
    await ProxyManager.enableProxy()
  }
  if (!await ProxyManager.setProxy()) {
    const { proxySetupError = '' } =
      await browser.storage.local.get('proxySetupError')

    throw new Error(`${getMessage('proxySetupFailed')} ${proxySetupError}`.trim())
  }
}

export const proxyControl = async () => {
  if (!await ProxyManager.controlledByOtherExtensions()) {
    return { controlled: false, extensions: [] }
  }
  const self = await browser.management.getSelf()
  const installed = await browser.management.getAll()

  return {
    controlled: true,
    extensions: installed.filter(({ name, permissions }) =>
      permissions?.includes('proxy') && name !== self.name),
  }
}

export const takeProxyControl = async () => {
  await ProxyManager.takeControl()
  await ProxyManager.setProxy()
}

export const saveDomains = async (list: unknown) => {
  if (!isRecord(list) || !Array.isArray(list.domains)) {
    throw new TypeError('Invalid domain list')
  }
  const names = removeDuplicates(list.domains)

  await browser.storage.local.set(list.ignored
    ? { ignoredHosts: names } : { customProxiedDomains: names })
  return names
}

// Returns null when the address is not a web URL.
export const downloadDomains = async (url: unknown) =>
  typeof url === 'string' && isValidURL(url)
    ? requestText(url, { maxBytes: 64000 }) : null

// Records the consent prompt when no choice is saved.
export const consentPrompt = async () => {
  if (await getDataConsent()) {
    return false
  }
  await browser.storage.local.set({ consentPromptVersion: CONSENT_VERSION })
  return true
}

export type Preferences = Partial<Pick<StorageState,
  'showNotifications' | 'uiLanguage' | 'updateAvailable'>>
const preferences: Partial<Record<string, unknown[]>> = {
  showNotifications: [true, false],
  uiLanguage: ['auto', 'en', 'ru', 'uk'],
  updateAvailable: [false],
}
const isPreferences = (values: unknown): values is Preferences =>
  isRecord(values) && Object.entries(values).every(([key, value]) =>
    preferences[key]?.includes(value))

export const setPreferences = async (values: unknown) => {
  if (!isPreferences(values)) {
    throw new TypeError('Invalid preference')
  }
  await browser.storage.local.set(values)
}
