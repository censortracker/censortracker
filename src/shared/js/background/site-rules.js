import browser from './browser-api'
import { normalizeCountryCodes } from './geoip'
import {
  isIgnoredHost,
  isPrivateHost,
  matchBlockedSuffix,
  toPunycode,
} from './host-rules'
import { hashHost, toSecondLevel } from './pac'

/**
 * Reads the per-site country rules.
 * @returns {Promise<Object<string, Array<string>>>} site -> blocked codes.
 */
export const getSiteCountryRules = async () => {
  const { siteCountryRules } =
    await browser.storage.local.get({ siteCountryRules: {} })

  if (!siteCountryRules || typeof siteCountryRules !== 'object') {
    return {}
  }

  const rules = {}

  for (const [site, codes] of Object.entries(siteCountryRules)) {
    const key = toSecondLevel(site)
    const normalized = normalizeCountryCodes(codes)

    if (key && normalized.length > 0) {
      rules[key] = normalized
    }
  }
  return rules
}

/**
 * Replaces the blocked-country list for one site. An empty list drops the
 * rule entirely rather than storing an entry that means nothing.
 * @param site {string} Any host; stored under its second-level form.
 * @param codes {Array<string>|string} Country codes to refuse.
 * @returns {Promise<Object<string, Array<string>>>} The updated rule set.
 */
export const setSiteCountryRule = async (site, codes) => {
  const key = toSecondLevel(site)

  if (!key) {
    return getSiteCountryRules()
  }

  const rules = await getSiteCountryRules()
  const normalized = normalizeCountryCodes(codes)

  if (normalized.length === 0) {
    delete rules[key]
  } else {
    rules[key] = normalized
  }

  await browser.storage.local.set({ siteCountryRules: rules })
  return rules
}

/**
 * The country a proxy is judged by for the rules and for the popup.
 *
 * The exit country is what the site actually sees, so it wins; the country of
 * the entry address is the fallback for a proxy that has not been checked yet.
 * @param proxy {{id: string, uri: string}}
 * @param statuses {Object} Stored per-proxy check results.
 * @param geo {Object} Cached host -> { code, name }.
 * @returns {string} Upper-case code, or '' when unknown.
 */
export const countryOfProxy = (proxy, statuses, geo, hostFromUri) => {
  const status = statuses[proxy.id]

  if (status && status.exitCountry) {
    return String(status.exitCountry).toUpperCase()
  }

  const info = geo[hostFromUri(proxy.uri)]

  return info && info.code ? String(info.code).toUpperCase() : ''
}

/**
 * Works out what the PAC will do with a host, without running it.
 *
 * The extension cannot evaluate its own PAC — `new Function` is barred by the
 * MV3 content security policy — so this mirrors FindProxyForURL instead. The
 * two are pinned together by a test that runs the real generated script over
 * the same hosts and asserts identical answers; the popup reports what this
 * returns, so a silent divergence would make it lie to the user.
 *
 * @param host {string} Destination host.
 * @param context {{proxies: Array, chainIds: Array<string>, proxyAll: boolean,
 *   isBlocked: Function, countries: Array<string>, rules: Object,
 *   ignoredHosts: Object|null}}
 * @returns {{proxied: boolean, proxy: Object|null, chain: Array, reason: string}}
 *   `reason` is one of: 'private', 'ignored', 'not-blocked', 'no-proxies',
 *   'all-countries-blocked', 'proxied'. `chain` is the full failover order for
 *   this host — the same rotation the PAC would return, primary first — which
 *   is what Firefox's `proxy.onRequest` path hands to the browser.
 */
export const resolveProxyForHost = (host, context) => {
  const {
    proxies = [],
    proxyAll = false,
    isBlocked = () => false,
    countries = [],
    rules = {},
    ignoredHosts = null,
  } = context || {}

  const clean = String(host || '').replace(/\.$/, '').toLowerCase()
  const direct = (reason) => {
    return { proxied: false, proxy: null, chain: [], reason }
  }

  if (!clean) {
    return direct('private')
  }

  // Both checks come first and apply to every mode, exactly as they do in
  // FindProxyForURL — see the PAC for why they sit ahead of everything else.
  if (isPrivateHost(clean)) {
    return direct('private')
  }

  if (isIgnoredHost(clean, ignoredHosts)) {
    return direct('ignored')
  }

  const site = toSecondLevel(clean)
  let target

  if (proxyAll) {
    target = clean
  } else if (/\.(onion|i2p)$/.test(site)) {
    target = site
  } else {
    // Matched by suffix, exactly as FindProxyForURL matches it, and the entry
    // that matched is what picks the proxy.
    const blocked = matchBlockedSuffix(clean, isBlocked)

    if (!blocked) {
      return direct('not-blocked')
    }
    target = blocked
  }

  if (proxies.length === 0) {
    return direct('no-proxies')
  }

  // Rule keys are normalized the same way the PAC generator normalizes them,
  // so a rule written against a subdomain still matches its site here.
  let codes = []

  for (const [key, value] of Object.entries(rules)) {
    if (toPunycode(toSecondLevel(key)) === toPunycode(site)) {
      codes = value
      break
    }
  }

  const blocked = new Set(codes)
  const allowed = proxies.filter((proxy, index) => {
    return !countries[index] || !blocked.has(countries[index])
  })

  if (allowed.length === 0) {
    return direct('all-countries-blocked')
  }

  // The same rotation `buildRotations` precomputes for the PAC: start at the
  // hashed primary and wrap around, so the remaining proxies stay available as
  // failover in exactly the order the PAC would have tried them.
  const primary = hashHost(target) % allowed.length
  const chain = allowed.slice(primary).concat(allowed.slice(0, primary))

  return {
    proxied: true,
    proxy: chain[0],
    chain,
    reason: 'proxied',
  }
}
