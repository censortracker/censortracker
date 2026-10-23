import browser, { getDetailedBrowserInfo } from './browser-api'
import { findHostMatch } from './host-match'
import ProxyManager from './proxy'
import { getProxyCheckState } from './proxy-check'
import type { ProxyCheck, ProxyFailure } from './proxy-check-data'
import { checkAttempts, countryCode, currentProxyCheck } from './proxy-check-data'
import { readProxyState } from './proxy-list'
import type { ManagedProxy, ProxyRecord } from './proxy-record'
import { hasProxyAuth, proxyAuthSupported } from './proxy-record'
import Registry from './registry'
import { getRegistrySourceState } from './registry-source'
import type { BuiltinRegistryCache } from './server'
import { settingsDefaults } from './settings-data'
import type { StorageState } from './storage'

// Optional browser APIs must not prevent a diagnostic report.
const optional = async <T>(read: () => Promise<T>) => {
  try {
    return await read()
  } catch {
    return null
  }
}

const redactText = (value: string | undefined,
  secrets: string[],
  privateHosts: Set<string>) => {
  let text = (value || '').replace(/https?:\/\/[^\s"'<>]+/gi, '[URL]')

  text = text.replace(/(?:[\w-]+\.)+[\w-]+/g, (host) =>
    findHostMatch(host, privateHosts) ? '[domain]' : host)
  for (const secret of secrets) {
    text = text.split(secret).join('[redacted]')
  }
  return text
}

const describeCheck = (check?: ProxyCheck) => check ? {
  ...(check.attempts ? { attempts: checkAttempts(check) } : {}),
  status: check.status,
  checkedAt: check.checkedAt,
  latency: check.latency,
  exitCountry: countryCode(check.exitCountry),
  serverCountry: countryCode(check.serverCountry),
} : null

const describeProxy = async (proxy: ManagedProxy,
  state: {
    proxyFailures?: Record<string,
      ProxyFailure>;
    selectedProxyIds: Set<string>
  },
  selected: Map<string,
    ProxyRecord>,
  checks: Record<string,
    ProxyCheck>) => {
  const failure = await currentProxyCheck(proxy, state.proxyFailures || {})
  const active = selected.get(proxy.id)

  return {
    id: proxy.id,
    protocol: proxy.protocol,
    host: proxy.host,
    port: proxy.port,
    hasAuth: hasProxyAuth(proxy),
    authSupported: proxyAuthSupported(proxy, browser.isFirefox),
    selected: state.selectedProxyIds.has(proxy.id),
    available: active?.retryAt !== undefined && active.retryAt <= Date.now(),
    retryAt: active?.retryAt || failure?.retryAt || null,
    check: describeCheck(checks[proxy.id]),
  }
}

const size = (list?: unknown[]) => list?.length || 0

const describeRegistry = (state: Partial<StorageState>, status: NonNullable<StorageState['registryStatus']>, domainCount: number, external: Awaited<ReturnType<typeof getRegistrySourceState>>, text: (value?: string) => string) => {
  const cache: Partial<BuiltinRegistryCache> = state.registryCache || {}

  return {
    ...status,
    error: text(status.error),
    updatedAt: cache.updatedAt || null,
    domainCount,
    builtinCount: size(state.domains),
    primaryCount: size(cache.primary),
    customCount: size(cache.custom),
    backendCount: size(cache.backend),
    providerCount: size(state.antizapret?.domains),
    external: {
      kind: external.source.kind,
      enabled: external.source.enabled,
      autoUpdate: external.source.autoUpdate,
      count: external.count,
      updatedAt: external.updatedAt || null,
    },
  }
}

const describeHealth = (state: Partial<StorageState>,
  control: { levelOfControl: string } | null) => ({

  proxyIsAlive: state.proxyIsAlive ?? null,
  localProxyAlive: state.localProxyAlive ?? false,
  proxyRecoveryAt: state.proxyRecoveryAt || null,
  proxyLastFetchTs: state.proxyLastFetchTs || null,
  proxyLevelOfControl: control?.levelOfControl || null,
  proxyControlled: control?.levelOfControl === 'controlled_by_this_extension',
  fallbackProxyInUse: state.fallbackProxyInUse ?? false,
  badProxies: state.badProxies || [],
})

const describeErrors = (state: Partial<StorageState>,
  text: (value?: string) => string) => ({

  fallbackReason: text(state.fallbackReason),
  fallbackProxyError: text(state.fallbackProxyError),
  serviceErrors: (state.serviceErrors || []).map(text),
  serviceRouteError: text(state.serviceRouteError),
  proxySetupError: text(state.proxySetupError),
})

export const getDiagnosticInfo = async () => {
  const [stored, catalog, selected, checkState, registryStatus, domainCount,
    external, control, extensions, self, platform, incognitoAllowed, alarms] =
    await Promise.all([
      browser.storage.local.get(null),
      readProxyState(),
      ProxyManager.getSelectedProxies(),
      getProxyCheckState(),
      Registry.getStatus(),
      Registry.getDomainCount(),
      getRegistrySourceState(),
      optional(() => browser.proxy.settings.get({})),
      optional(() => browser.management.getAll()),
      optional(() => browser.management.getSelf()),
      optional(() => browser.runtime.getPlatformInfo()),
      optional(() => browser.extension.isAllowedIncognitoAccess()),
      optional(() => browser.alarms.getAll()),
    ])
  const state = { ...settingsDefaults, ...stored, ...catalog }
  const proxies = [catalog.builtin, ...catalog.proxies]

  if (state.useLocalProxy) {
    state.selectedProxyIds = ['local']
    proxies.push(selected[0] || { id: 'local', protocol: 'SOCKS5' })
  }
  const proxyState = {
    ...state,
    selectedProxyIds: new Set(state.selectedProxyIds),
  }
  const selectedById = new Map(selected.map((proxy) => [proxy.id, proxy]))
  const secrets = proxies.flatMap(({ username, password }) =>
    [username, password]).filter((value): value is string => Boolean(value))
    .flatMap((value) => [value, encodeURIComponent(value)])
    .sort((first, second) =>
      second.length - first.length)
  const privateHosts = new Set([...state.ignoredHosts,
    ...state.customProxiedDomains, ...Object.keys(state.siteCountryRules)])
  const text = (value?: string) => redactText(value, secrets, privateHosts)
  const { version, manifest_version: manifestVersion } =
    browser.runtime.getManifest()
  const localConfig = state.localConfig || {}

  return {
    reportType: 'censortracker-diagnostics',
    reportVersion: 1,
    generatedAt: new Date().toISOString(),
    version,
    manifestVersion,
    configSource: localConfig.configSource,
    mirrors: {
      checkedAt: state.mirrorsCheckedAt || null,
      updatedAt: state.mirrorsUpdatedAt || null,
      error: text(state.mirrorsError),
    },
    browser: await getDetailedBrowserInfo(),
    platform,
    incognitoAllowed,
    modes: Object.fromEntries(Object.entries(settingsDefaults)
      .filter(([, value]) => typeof value === 'boolean')
      .map(([key]) => [key, state[key as keyof typeof state]])),
    region: {
      configured: state.currentRegionCode,
      detected: localConfig.countryCode,
      registry: state.registryRegionCode,
      geoIPStatus: text(state.geoIPStatus),
    },
    selectedProxyIds: state.selectedProxyIds,
    configuredSelectedProxyIds: catalog.selectedProxyIds,
    proxies: await Promise.all(proxies.map((proxy) =>
      describeProxy(proxy, proxyState, selectedById, checkState.checks))),
    proxyCheckRun: checkState.run,
    ...describeHealth(state, control),
    ...describeErrors(state, text),
    currentProxyURI: await ProxyManager.getProxyingRules(),
    conflictingExtensions: extensions?.filter(({ id, enabled, permissions }) =>
      id !== self?.id && enabled && permissions?.includes('proxy'))
      .map(({ name, version: extensionVersion }) => ({
        name: text(name), version: extensionVersion,
      })) ?? null,
    registry: describeRegistry(state, registryStatus,
      domainCount, external, text),
    rules: {
      ignoredHostCount: state.ignoredHosts.length,
      customProxiedDomainCount: state.customProxiedDomains.length,
      siteCountryRuleCount: Object.keys(state.siteCountryRules).length,
      subscriptionCount: state.proxySubscriptions.length,
    },
    alarms: alarms?.map(({ name, scheduledTime, periodInMinutes }) => ({
      name, scheduledTime, periodInMinutes,
    })) ?? null,
  }
}
