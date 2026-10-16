import type { Consent } from './data-consent'
import type { ProxyCheck, ProxyCheckRun, ProxyFailure } from './proxy-check-data'
import type { ProxyRecord } from './proxy-record'
import type { Subscription } from './proxy-source'
import type { ExternalRegistry, RegistrySource } from './registry-source-data'
import type { BuiltinRegistryCache } from './server'
import type { Disseminator, RegionConfig } from './service-config'
import type { ServiceMirrors } from './service-mirrors'
import type { SettingsData } from './settings-data'

export interface ProxySettings {
  mode?: string
  pacScript?: { data?: string; mandatory?: boolean }
  proxyType?: string
  autoConfigUrl?: string
}
export interface StorageState extends SettingsData {
  dataConsent: Consent | null
  consentPromptVersion: number
  consentInstallPending: boolean
  proxies: ProxyRecord[] | null
  selectedProxyIds: string[] | null
  domains: string[]
  domainsRevision: string
  disseminators: Disseminator[]
  externalRegistry: ExternalRegistry | null
  externalRegistryRevision: string
  registrySource: RegistrySource
  registryRegionCode: string
  registryStatus: { state: string; skipped: number; error: string } | null
  registryCache: BuiltinRegistryCache | null
  proxyChecks: Record<string, ProxyCheck>
  proxyFailures: Record<string, ProxyFailure>
  proxyCheckRun: ProxyCheckRun
  proxyProbeActive: boolean
  proxySubscriptions: Subscription[]
  proxySubscriptionCursor: number
  proxyServerURI: string | null
  proxyPingURI: string | null
  localProxyURI: string | null
  localProxyAlive: boolean
  proxyIsAlive: boolean
  proxySetupError: string
  activeProxyConfigName: string
  antizapret: { domains: string[]; proxyKeys: string[] } | null
  serviceRouteSnapshot: { value: ProxySettings; owned: boolean } | null
  serviceErrors: string[]
  badProxies: string[]
  privateBrowsingPermissionsRequired: boolean
  backendIsIntermittent: boolean
  updateAvailable: boolean
  botDetection: boolean
  lastSync: number
  notifiedHosts: string[]
  localConfig: Partial<RegionConfig>
  unsupportedCountry: boolean
  geoIPStatus: string
  currentProxyServer: string
  proxyLastFetchTs: number
  proxyRecoveryAt: number
  serviceRouteError: string
  serviceMirrors: ServiceMirrors
  mirrorsCheckedAt: number
  mirrorsUpdatedAt: number
  mirrorsError: string
  fallbackReason: string
  fallbackProxyError: string
  fallbackProxyInUse: boolean
  [key: `noticeRead:${string}`]: boolean
  [key: `noticeActive:${string}`]: boolean
}

type Key = keyof StorageState
type WithDefaults<T> = { [K in keyof T]: K extends Key
  ? Exclude<StorageState[K], null> | Extract<T[K], null> : T[K] }

export interface LocalStorage {
  get(keys: null): Promise<Partial<StorageState>>
  get<K extends Key>(key: K): Promise<{ [P in K]?: StorageState[P] }>
  get<K extends Key>(keys: K[]): Promise<{ [P in K]?: StorageState[P] }>
  get<T extends Record<string, unknown>>(defaults: T): Promise<WithDefaults<T>>
  set(values: Partial<StorageState>): Promise<void>
  remove(keys: string | string[]): Promise<void>
  clear(): Promise<void>
}

export type StorageChanges = {
  [K in keyof StorageState]?: {
    oldValue?: StorageState[K]
    newValue?: StorageState[K]
  }
}
