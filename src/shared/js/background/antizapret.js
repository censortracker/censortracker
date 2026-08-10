import {
  fetchWithTimeout,
  looksLikePacScript,
  parsePacProxies,
} from './utilities'

/**
 * Antizapret (antizapret.prostovpn.org) as a source of proxy servers.
 *
 * Antizapret is a third-party circumvention service that publishes a PAC
 * script naming the proxies it routes blocked sites through. It does not
 * publish a plain list, so the servers are read out of that script and then
 * treated like any other proxy in the list — checked, ordered, and subject to
 * the same per-site rules.
 *
 * Two facts about the service shape this code:
 *
 *   - It answers only from Russian IP addresses. Anywhere else the request is
 *     refused or reset, which is a property of the service and not a bug here;
 *     it has to be reported as such rather than as a failed download.
 *   - The DNS records of its proxies are unreliable exactly where the service
 *     is meant to be used, so the addresses are resolved over DNS-over-HTTPS
 *     and pinned. The hostname is kept as the display name so a proxy stays
 *     recognisable after its address rotates.
 */

// Published mirrors, tried in order. The alternate ports exist because the
// standard ones are the first thing to be blocked.
export const ANTIZAPRET_PAC_URLS = [
  'https://antizapret.prostovpn.org/proxy.pac',
  'https://antizapret.prostovpn.org:8443/proxy.pac',
  'https://antizapret.prostovpn.org:18443/proxy.pac',
]

// A PAC carrying a full blocklist runs to tens of megabytes. Only the proxy
// tokens are wanted, so the download is capped rather than allowed to grow
// without bound in a service worker.
const MAX_PAC_BYTES = 24 * 1024 * 1024

const DOH_URL = 'https://dns.google/resolve'

/**
 * Random padding for a DNS-over-HTTPS query, so requests do not all share a
 * length that identifies which name was asked for (RFC 8467).
 * @returns {string}
 */
const randomPadding = () => {
  const size = 30 + Math.floor(Math.random() * 200)
  const bytes = new Uint8Array(size)

  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const IPV4 = /^\d{1,3}(\.\d{1,3}){3}$/

/**
 * Resolves a hostname to its IPv4 addresses over DNS-over-HTTPS.
 * @param {string} host
 * @param {{timeout?: number}} [options]
 * @returns {Promise<Array<string>>} Addresses, or empty when unresolvable.
 */
export const resolveOverHttps = async (host, { timeout = 8000 } = {}) => {
  if (!host || IPV4.test(host)) {
    return host ? [host] : []
  }

  const query =
    `${DOH_URL}?name=${encodeURIComponent(host)}&type=A` +
    `&random_padding=${randomPadding()}`

  try {
    const response = await fetchWithTimeout(query, {
      timeout,
      cache: 'no-store',
      headers: { accept: 'application/dns-json' },
    })

    if (!response.ok) {
      return []
    }

    const body = await response.json()

    // Type 1 is an A record; the answer also carries the CNAME hops that led
    // to it, which are names rather than addresses.
    return (body.Answer || [])
      .filter((answer) => answer.type === 1 && IPV4.test(answer.data))
      .map((answer) => answer.data)
  } catch (error) {
    console.warn(`DoH lookup failed for ${host}: ${error}`)
    return []
  }
}

/**
 * Downloads the PAC from the first mirror that answers with one.
 * @param {{timeout?: number}} [options]
 * @returns {Promise<{text: string, url: string, reason: string}>} `reason` is
 *   '' on success, 'unavailable' when a mirror answered but not with a PAC
 *   (which is how the geo restriction presents itself), or 'unreachable' when
 *   no mirror could be contacted at all.
 */
export const fetchAntizapretPac = async ({ timeout = 30000 } = {}) => {
  let reason = 'unreachable'

  for (const url of ANTIZAPRET_PAC_URLS) {
    try {
      const response = await fetchWithTimeout(url, { timeout, cache: 'no-store' })

      if (!response.ok) {
        continue
      }

      const size = Number(response.headers.get('content-length'))

      if (Number.isFinite(size) && size > MAX_PAC_BYTES) {
        console.warn(`Antizapret PAC at ${url} is too large (${size} bytes).`)
        continue
      }

      const text = await response.text()

      if (looksLikePacScript(text)) {
        return { text, url, reason: '' }
      }

      // Reached the service, which declined to serve a script — outside
      // Russia it answers with a short explanation instead.
      console.warn(`Antizapret at ${url} did not return a PAC script.`)
      reason = 'unavailable'
    } catch (error) {
      console.warn(`Antizapret mirror ${url} failed: ${error}`)
    }
  }

  return { text: '', url: '', reason }
}

/**
 * Reads the proxies out of the Antizapret PAC and pins their addresses.
 *
 * A hostname that resolves to several addresses yields one proxy per address:
 * they are genuinely separate servers, and keeping them apart lets the checker
 * find the ones that actually answer.
 * @param {{timeout?: number, resolve?: boolean}} [options] - `resolve: false`
 *   keeps the hostnames as published, skipping the DoH step.
 * @returns {Promise<{proxies: Array, reason: string, source: string}>}
 */
export const getAntizapretProxies = async ({
  timeout = 30000,
  resolve = true,
} = {}) => {
  const { text, url, reason } = await fetchAntizapretPac({ timeout })

  if (!text) {
    return { proxies: [], reason, source: '' }
  }

  const found = parsePacProxies(text)

  if (found.length === 0) {
    return { proxies: [], reason: 'empty', source: url }
  }

  const proxies = []
  const seen = new Set()
  const add = (protocol, uri, label) => {
    const key = `${protocol}|${uri}`.toLowerCase()

    if (!seen.has(key)) {
      seen.add(key)
      proxies.push({
        name: label,
        protocol,
        uri,
        credentials: '',
        // These relay only to the sites Antizapret exists for, so an ordinary
        // connectivity probe fails against them by design.
        restricted: true,
      })
    }
  }

  for (const proxy of found) {
    const label = `Антизапрет — ${proxy.host}`

    // An HTTPS proxy is reached over TLS, and the certificate is issued for the
    // name — swapping in the address would fail validation and break a proxy
    // that works perfectly well by hostname. Pinning is for the protocols that
    // do not authenticate the endpoint by name.
    if (!resolve || proxy.protocol === 'HTTPS' || IPV4.test(proxy.host)) {
      add(proxy.protocol, proxy.uri, label)
      continue
    }

    const addresses = await resolveOverHttps(proxy.host, { timeout: 8000 })

    if (addresses.length === 0) {
      // Nothing resolved: keep the hostname so the browser can try it itself.
      add(proxy.protocol, proxy.uri, label)
      continue
    }

    for (const address of addresses) {
      add(proxy.protocol, `${address}:${proxy.port}`, label)
    }
  }

  return { proxies, reason: '', source: url }
}
