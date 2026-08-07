import browser from './browser-api'
import { normalizeCountryCodes } from './geoip'
import { hashHost, toPunycode, toSecondLevel } from './pac'

// Private and local destinations the PAC sends straight out, mirrored here so
// the popup does not claim a proxy for something that never goes through one.
const PRIVATE_HOST = [
  /^localhost$/i,
  /\.local$/i,
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^::1$/,
  /^f[cd][0-9a-f]{2}:/i,
  /^fe80:/i,
]

const isPrivateHost = (host) => {
  if (!host) {
    return true
  }
  // Patterns first: an IPv6 literal has no dot, so checking "is it a plain
  // host name" ahead of them would let fe80:: and fc00:: through.
  if (PRIVATE_HOST.some((pattern) => pattern.test(host))) {
    return true
  }
  // isPlainHostName() in the PAC: a single-label host is local.
  return !host.includes('.') && !host.includes(':')
}

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
 *   isBlocked: Function, countries: Array<string>, rules: Object}}
 * @returns {{proxied: boolean, proxy: Object|null, reason: string}}
 *   `reason` is one of: 'private', 'not-blocked', 'no-proxies',
 *   'all-countries-blocked', 'proxied'.
 */
export const resolveProxyForHost = (host, context) => {
  const {
    proxies = [],
    proxyAll = false,
    isBlocked = () => false,
    countries = [],
    rules = {},
  } = context || {}

  const clean = String(host || '').replace(/\.$/, '').toLowerCase()
  const direct = (reason) => ({ proxied: false, proxy: null, reason })

  if (!clean) {
    return direct('private')
  }

  const site = toSecondLevel(clean)
  let target

  if (proxyAll) {
    if (isPrivateHost(clean)) {
      return direct('private')
    }
    target = clean
  } else {
    const isDarknet = /\.(onion|i2p)$/.test(site)

    if (!isDarknet && !isBlocked(site)) {
      return direct('not-blocked')
    }
    target = site
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

  return {
    proxied: true,
    proxy: allowed[hashHost(target) % allowed.length],
    reason: 'proxied',
  }
}
