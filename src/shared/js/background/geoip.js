import browser from './browser-api'
import { fetchWithTimeout } from './utilities'

// Free, key-less, HTTPS geo-IP endpoint that accepts a comma-separated batch of
// IPs and returns [{ ip, country, country_3, name }]. HTTPS matters: an
// extension page is a secure context, so plain-HTTP geo APIs are blocked as
// mixed content.
const GEOJS_BATCH_URL = 'https://get.geojs.io/v1/ip/country.json?ip='
const BATCH_SIZE = 90

// Geo-IP only maps addresses, so a proxy written as a hostname has to be
// resolved first. Extensions get no DNS API on Chromium, so this goes through
// DNS-over-HTTPS. Two independent resolvers, tried in order: one being blocked
// or down should not cost the whole feature.
//
// Trade-off worth knowing: resolving a hostname discloses it to the resolver.
// That is the same class of exposure as the geo-IP lookup this feeds, and it
// only happens for hostname proxies, on the same explicit "determine
// countries" action — never for proxies already given as IP addresses.
const DOH_RESOLVERS = [
  'https://cloudflare-dns.com/dns-query?type=A&name=',
  'https://dns.google/resolve?type=A&name=',
]

const DOH_TIMEOUT = 8000

/**
 * @param {string} host
 * @returns {boolean} true for something that can plausibly be resolved.
 */
const isResolvableHostname = (host) => {
  return typeof host === 'string' &&
    /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/i
      .test(host) &&
    host.length <= 253
}

/**
 * Resolves a hostname to its first IPv4 address over DNS-over-HTTPS.
 * @param {string} host
 * @param {{signal?: AbortSignal}} [options]
 * @returns {Promise<string>} The address, or '' when it cannot be resolved.
 */
export const resolveHostToIpv4 = async (host, { signal } = {}) => {
  if (!isResolvableHostname(host)) {
    return ''
  }

  for (const resolver of DOH_RESOLVERS) {
    if (signal && signal.aborted) {
      return ''
    }

    try {
      const response = await fetchWithTimeout(
        resolver + encodeURIComponent(host),
        {
          timeout: DOH_TIMEOUT,
          signal,
          cache: 'no-store',
          headers: { Accept: 'application/dns-json' },
        },
      )

      if (!response.ok) {
        continue
      }

      const payload = await response.json()
      // RFC 8484 JSON: Answer[] with type 1 (A) records in `data`.
      const answers = Array.isArray(payload && payload.Answer)
        ? payload.Answer
        : []

      for (const answer of answers) {
        if (answer && answer.type === 1 && isIpv4(answer.data)) {
          return answer.data
        }
      }
    } catch (error) {
      // Try the next resolver.
    }
  }

  return ''
}

/**
 * @param {string} host
 * @returns {boolean} true for an IPv4 literal (the only form geo-IP can map).
 */
export const isIpv4 = (host) => {
  if (!/^(\d{1,3}\.){3}\d{1,3}$/.test(host)) {
    return false
  }
  return host.split('.').every((part) => Number(part) <= 255)
}

/**
 * Extracts the host part of a "host:port" proxy URI.
 * @param {string} uri
 * @returns {string}
 */
export const hostFromUri = (uri) => {
  if (!uri) {
    return ''
  }
  const lastColon = uri.lastIndexOf(':')

  return lastColon === -1 ? uri : uri.slice(0, lastColon)
}

/**
 * Parses the body of an IP-echo endpoint into the exit IP (and country when
 * the endpoint reports it). Supports the Cloudflare trace format
 * ("ip=1.2.3.4\nloc=NL\n...") and plain-text responses that start with the
 * address (checkip/ipify/icanhazip-style).
 * @param {string} body - Raw response body.
 * @returns {{ip: string, code: string}|null}
 */
export const parseExitInfo = (body) => {
  if (!body || typeof body !== 'string') {
    return null
  }

  const text = body.trim().slice(0, 4096)
  const traceIp = text.match(/^ip=(\S+)$/m)

  if (traceIp) {
    const traceLoc = text.match(/^loc=([A-Z]{2})$/m)

    return { ip: traceIp[1], code: traceLoc ? traceLoc[1] : '' }
  }

  const first = text.split(/\s+/)[0]

  if (isIpv4(first)) {
    return { ip: first, code: '' }
  }
  // IPv6 (returned by dual-stack echo services when the proxy is v6-only).
  if (first.includes(':') && /^[0-9a-fA-F:.]+$/.test(first)) {
    return { ip: first, code: '' }
  }
  return null
}

/**
 * Returns the cached host -> { code, name } geo map.
 * @returns {Promise<Object>}
 */
export const getCachedGeo = async () => {
  const { proxyGeo } = await browser.storage.local.get({ proxyGeo: {} })

  return proxyGeo
}

const chunk = (array, size) => {
  const chunks = []

  for (let index = 0; index < array.length; index += size) {
    chunks.push(array.slice(index, index + size))
  }
  return chunks
}

/**
 * Turns free-form country input ("ru, CN; 🇮🇷 IR") into a de-duplicated list of
 * upper-case ISO-3166 alpha-2 codes. Anything that isn't a two-letter token is
 * dropped, so a typo can never silently widen or narrow a filter.
 * @param {string|Array<string>} value
 * @returns {Array<string>}
 */
export const normalizeCountryCodes = (value) => {
  const raw = Array.isArray(value) ? value.join(',') : String(value || '')

  return [...new Set(
    raw
      .split(/[\s,;|]+/)
      .map((token) => token.trim().toUpperCase())
      .filter((token) => /^[A-Z]{2}$/.test(token)),
  )]
}

/**
 * Looks up the countries of the given hosts, using (and updating) the local
 * cache so each IP is only fetched once. Non-IPv4 hosts and lookup failures are
 * skipped silently. Returns the merged host -> { code, name } map.
 *
 * The lookup talks to a geo-IP service, NOT to the proxies themselves: it is
 * how the country of a proxy is known *before* anything is connected to or
 * scanned.
 * @param {Array<string>} hosts
 * @param {{onProgress?: Function, signal?: AbortSignal}} [options] -
 *   `onProgress(done, total)` fires after each batch so a long list can be
 *   reported live; `signal` stops the run between batches (an in-flight batch
 *   is bounded by its own timeout).
 * @returns {Promise<Object>}
 */
export const lookupCountries = async (hosts, { onProgress, signal } = {}) => {
  const cache = await getCachedGeo()
  const unknown = [...new Set(
    hosts.filter((host) => host && !(host in cache)),
  )]

  // Hostnames have to become addresses before geo-IP can say anything about
  // them. Each resolved name is remembered against the *hostname*, so the grid
  // can look it up by the value it actually shows.
  const addressOf = new Map()
  const toResolve = unknown.filter((host) => !isIpv4(host))

  for (const host of toResolve) {
    if (signal && signal.aborted) {
      break
    }

    const address = await resolveHostToIpv4(host, { signal })

    if (address) {
      addressOf.set(host, address)
    }
  }

  for (const host of unknown) {
    if (isIpv4(host)) {
      addressOf.set(host, host)
    }
  }

  // One geo lookup per distinct address, however many names point at it.
  const pending = [...new Set(addressOf.values())]

  if (pending.length === 0) {
    return cache
  }

  const byAddress = {}
  let changed = false
  let done = 0

  for (const batch of chunk(pending, BATCH_SIZE)) {
    if (signal && signal.aborted) {
      break
    }

    try {
      const response = await fetchWithTimeout(GEOJS_BATCH_URL + batch.join(','), {
        timeout: 15000,
        cache: 'no-store',
      })

      if (response.ok) {
        const entries = await response.json()

        for (const entry of Array.isArray(entries) ? entries : []) {
          if (entry && entry.ip) {
            byAddress[entry.ip] = {
              code: entry.country || '',
              name: entry.name || '',
            }
          }
        }
      }
    } catch (error) {
      console.warn(`Geo-IP lookup failed for a batch: ${error}`)
    }

    done += batch.length
    if (typeof onProgress === 'function') {
      onProgress(Math.min(done, pending.length), pending.length)
    }
  }

  // Store the result against every host that maps to a resolved address, so a
  // hostname proxy gets its country cached under the hostname the grid shows.
  // Addresses geo-IP had nothing for are cached as empty on purpose: without
  // that they would be re-queried on every render.
  for (const [host, address] of addressOf) {
    const info = byAddress[address]

    if (info) {
      cache[host] = info
      changed = true
    }
  }

  if (changed) {
    await browser.storage.local.set({ proxyGeo: cache })
  }
  return cache
}
