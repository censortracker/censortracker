import { normalizeHostname } from './hostname'
import { parseProxyAddress, proxyProtocols } from './proxy-address'
import { proxyStateFromSettings } from './proxy-record'
import type { Subscription } from './proxy-source'
import { validateSubscriptions } from './proxy-source'
import type { RegistrySource } from './registry-source-data'
import { registrySourceDefaults, validateRegistrySource } from './registry-source-data'
import { settingsFromFork } from './settings-fork'
import type { SiteRules } from './site-rules'
import { validateSiteRules } from './site-rules'

export interface SettingsData {
  uiLanguage: string
  enableExtension: boolean
  useProxy: boolean
  proxyAll: boolean
  siteCountryRules: SiteRules
  proxySubscriptions: Subscription[]
  proxySubscriptionsEnabled: boolean
  proxyRecoveryEnabled: boolean
  useRegistry: boolean
  registrySource: RegistrySource
  showNotifications: boolean
  useOwnProxy: boolean
  useLocalProxy: boolean
  ignoredHosts: string[]
  customProxiedDomains: string[]
  currentRegionCode: string
  currentRegionName: string
  customProxyProtocol: string
  customProxyServerURI: string
}

export const settingsDefaults: SettingsData = {
  uiLanguage: 'auto',
  enableExtension: false,
  useProxy: true,
  proxyAll: false,
  siteCountryRules: {},
  proxySubscriptions: [],
  proxySubscriptionsEnabled: false,
  proxyRecoveryEnabled: false,
  useRegistry: true,
  registrySource: registrySourceDefaults,
  showNotifications: true,
  useOwnProxy: false,
  useLocalProxy: false,
  ignoredHosts: [],
  customProxiedDomains: [],
  currentRegionCode: '',
  currentRegionName: '',
  customProxyProtocol: 'HTTPS',
  customProxyServerURI: '',
}
const booleanKeys = new Set(
  (Object.keys(settingsDefaults) as (keyof SettingsData)[])
    .filter((key) => typeof settingsDefaults[key] === 'boolean'))
const hostKeys = new Set(['ignoredHosts', 'customProxiedDomains'])
const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' &&
  !Array.isArray(value)

export const validateSettings = (input: unknown) => {
  if (!isObject(input) || input.reportType !== undefined ||
    (input.formatVersion !== undefined &&
    input.formatVersion !== 1)) {
    throw new Error('Invalid settings format')
  }
  const settings = input.formatVersion === 1
    ? input.settings : settingsFromFork(input)
  const result: Record<string, unknown> = {}

  if (!isObject(settings)) {
    throw new Error('Invalid settings')
  }
  for (const [key, value] of Object.entries(settings)) {
    let valid = true

    if (key === 'registrySource') {
      result[key] = validateRegistrySource(value)
      continue
    } else if (key === 'siteCountryRules') {
      result[key] = validateSiteRules(value)
      continue
    } else if (key === 'proxySubscriptions') {
      result[key] = validateSubscriptions(value)
      continue
    } else if (key === 'proxies' || key === 'selectedProxyIds') {
      if (!Array.isArray(value)) {
        throw new TypeError('Invalid proxy selection')
      }
      result[key] = value
      continue
    } else if (booleanKeys.has(key as keyof SettingsData)) {
      valid = typeof value === 'boolean'
    } else if (hostKeys.has(key)) {
      if (!Array.isArray(value) || value.length > 100000) {
        throw new Error(`Invalid setting: ${key}`)
      }
      const names = value.map((name) => normalizeHostname(
        typeof name === 'string' ? name.trim() : name,
      ))

      if (names.some((name) => !name)) {
        throw new Error(`Invalid setting: ${key}`)
      }
      result[key] = Array.from(new Set(names))
      continue
    } else if (key === 'uiLanguage') {
      valid = typeof value === 'string' && ['auto', 'en', 'ru', 'uk'].includes(value)
    } else if (key === 'currentRegionCode') {
      valid = typeof value === 'string' && /^(?:[A-Z]{2})?$/.test(value)
    } else if (key === 'currentRegionName') {
      valid = typeof value === 'string' && value.length <= 100
    } else if (key === 'customProxyServerURI') {
      if (value !== '') {
        parseProxyAddress(value)
      }
    } else if (key === 'customProxyProtocol') {
      valid = typeof value === 'string' && proxyProtocols.includes(value)
    } else {
      continue
    }
    if (!valid) {
      throw new Error(`Invalid setting: ${key}`)
    }
    result[key] = value
  }
  return {
    ...result as Partial<SettingsData>,
    ...proxyStateFromSettings(result),
  }
}
