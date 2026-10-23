import type { DomainIndexData } from './domain-index'
import { createDomainIndex } from './domain-index'
import type { findHostMatch } from './host-match'
import { normalizeHostname } from './hostname'
import { proxyDirective } from './proxy-address'
import { countryCode } from './proxy-check-data'
import type { ProxyRecord } from './proxy-record'
import type { SiteRules } from './site-rules'
import { validateSiteRules } from './site-rules'

export interface ProbeRoute {
  hostname: string
  proxy: ProxyRecord
  expiresAt: number
  authFailed?: boolean
}
export interface RoutingOptions {
  domains?: string[] | DomainIndexData
  providerDomains?: string[] | DomainIndexData
  ignoredHosts?: string[]
  proxies?: ProxyRecord[]
  proxyAll?: boolean
  probes?: ProbeRoute[]
  siteCountryRules?: SiteRules
}
export interface RouteDecision {
  type: 'direct' | 'probe' | 'blocked' | 'proxy'
  proxies: string[]
  route: string
}

const finite = (value?: number) =>
  value !== undefined && Number.isFinite(value) ? value : 0

export const routingConfig = ({
  domains = [], ignoredHosts = [], proxies = [], proxyAll = false, probes = [],
  siteCountryRules = {}, providerDomains = [],
}: RoutingOptions) => ({
  proxyAll,
  providerDomains,
  siteCountryRules: validateSiteRules(siteCountryRules),
  domains: Array.isArray(domains)
    ? Array.from(new Set(domains.map(normalizeHostname)
      .filter((host): host is string => Boolean(host))))
    : domains,
  ignoredHosts: ignoredHosts.map(normalizeHostname)
    .filter((host): host is string => Boolean(host)),

  proxies: proxies.map(({
    id, protocol, host, port, retryAt, exitCountry, countryExpiresAt, provider,
  }) => ({
    id,
    provider,
    route: proxyDirective(protocol, `${host}:${port}`),
    retryAt: finite(retryAt),
    exitCountry: countryCode(exitCountry),
    countryExpiresAt: finite(countryExpiresAt),
  })),
  probes: probes.map(({ hostname, proxy, expiresAt }) => ({
    hostname: normalizeHostname(hostname),
    id: proxy.id,
    expiresAt,
    route: proxyDirective(proxy.protocol, `${proxy.host}:${proxy.port}`),
  })),
})

// Self-contained so PAC and extension code use the same route decision.
export const createRouter = (
  config: ReturnType<typeof routingConfig>, matchHost: typeof findHostMatch,
  privateHost: (host: string) => boolean, hostIndex = createDomainIndex,
) => {
  const domains = hostIndex(config.domains)
  const providerDomains = hostIndex(config.providerDomains)
  const ignored = new Set(config.ignoredHosts)
  const ruleHosts = new Set(Object.keys(config.siteCountryRules))
  const probes = new Map(config.probes.map((probe) => [probe.hostname, probe]))

  return (host: string): RouteDecision => {
    host = host.toLowerCase().replace(/\.$/, '')
    if (privateHost(host) || matchHost(host, ignored)) {
      return { type: 'direct', proxies: [], route: 'DIRECT' }
    }
    const probe = probes.get(host)
    const rule = matchHost(host, ruleHosts)
    const forbidden = (rule && config.siteCountryRules[rule]) || []

    if (probe) {
      return forbidden.length === 0 && Date.now() < probe.expiresAt
        ? { type: 'probe', proxies: [probe.id], route: probe.route }
        : { type: 'blocked', proxies: [], route: 'PROXY 127.0.0.1:0' }
    }
    const domain = matchHost(host, domains)
    const providerDomain = matchHost(host, providerDomains)

    if (!(config.proxyAll || host.endsWith('.onion') || host.endsWith('.i2p') ||
      domain || providerDomain)) {
      return { type: 'direct', proxies: [], route: 'DIRECT' }
    }
    const available = config.proxies.filter((proxy) =>
      proxy.retryAt <= Date.now() &&
      (!proxy.provider || providerDomain) &&
      (forbidden.length === 0 ||
        (proxy.exitCountry && proxy.countryExpiresAt > Date.now() &&
          !forbidden.includes(proxy.exitCountry))))

    if (available.length === 0) {
      return { type: 'blocked', proxies: [], route: 'PROXY 127.0.0.1:0' }
    }
    let hash = 0
    const site = /\.(onion|i2p)$/.test(host)
      ? host.split('.').slice(-2).join('.') : domain || providerDomain || host

    for (let index = 0; index < site.length; index++) {
      hash = (hash * 31 + site.charCodeAt(index)) % 2147483647
    }
    const offset = hash % available.length
    const proxies = available.slice(offset).concat(available.slice(0, offset))

    return {
      type: 'proxy',
      proxies: proxies.map(({ id }) => id),
      route: `${proxies.map(({ route }) => route).join('; ')};`,
    }
  }
}
