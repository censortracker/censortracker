import ProxyManager from './proxy'
import {
  extractHostnameFromUrl,
  fetchWithTimeout,
  parseProxyString,
} from './utilities'

/**
 * Curated, free, public proxy subscriptions. All of them are community lists
 * that are refreshed automatically on a schedule (verified to be live and
 * updating), so the user always gets a fresh batch to test:
 *
 *   - monosans/proxy-list   — re-checked & validated, updated hourly.
 *   - proxifly/free-proxy-list — updated roughly every 5 minutes.
 *   - TheSpeedX/PROXY-List  — large raw dump, updated daily.
 *
 * `protocol` is the fallback protocol for bare "host:port" lines; lines that
 * already carry a scheme (e.g. "socks5://1.2.3.4:1080") keep their own.
 */
export const SUBSCRIPTIONS = [
  {
    id: 'monosans-socks5',
    name: 'monosans · SOCKS5 (validated, hourly)',
    url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',
    protocol: 'SOCKS5',
    recommended: true,
  },
  {
    id: 'monosans-http',
    name: 'monosans · HTTP (validated, hourly)',
    url: 'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
    protocol: 'HTTP',
    recommended: true,
  },
  {
    id: 'proxifly-socks5',
    name: 'Proxifly · SOCKS5 (every ~5 min)',
    url: 'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks5/data.txt',
    protocol: 'SOCKS5',
  },
  {
    id: 'proxifly-socks4',
    name: 'Proxifly · SOCKS4 (every ~5 min)',
    url: 'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/socks4/data.txt',
    protocol: 'SOCKS4',
  },
  {
    id: 'proxifly-http',
    name: 'Proxifly · HTTP (every ~5 min)',
    url: 'https://raw.githubusercontent.com/proxifly/free-proxy-list/main/proxies/protocols/http/data.txt',
    protocol: 'HTTP',
  },
  {
    id: 'thespeedx-socks5',
    name: 'TheSpeedX · SOCKS5 (daily)',
    url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
    protocol: 'SOCKS5',
  },
  {
    id: 'thespeedx-http',
    name: 'TheSpeedX · HTTP (daily)',
    url: 'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
    protocol: 'HTTP',
  },
]

export const getSubscriptionById = (id) => {
  return SUBSCRIPTIONS.find((subscription) => subscription.id === id) || null
}

/**
 * Parses a raw subscription/text body into a deduplicated proxy list.
 * Accepts one proxy per line, in any format `parseProxyString` understands.
 * @param {string} text - Raw list body.
 * @param {string} defaultProtocol - Protocol for lines without a scheme.
 * @param {number} [limit=0] - Max proxies to keep (0 = no limit).
 * @returns {Array<{name: string, protocol: string, uri: string}>}
 */
export const parseSubscription = (text, defaultProtocol = 'HTTPS', limit = 0) => {
  const proxies = []
  const seen = new Set()

  for (const rawLine of String(text).split(/\r?\n/)) {
    const line = rawLine.trim()

    if (!line || line.startsWith('#') || line.startsWith('//')) {
      continue
    }

    const parsed = parseProxyString(line, defaultProtocol)

    if (!parsed) {
      continue
    }

    const key = `${parsed.protocol}|${parsed.uri}`.toLowerCase()

    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    proxies.push({
      name: parsed.uri,
      protocol: parsed.protocol,
      uri: parsed.uri,
    })

    if (limit && proxies.length >= limit) {
      break
    }
  }

  return proxies
}

/**
 * Downloads a proxy list from a URL and parses it. When `viaActiveProxy` is set
 * and the user has a working proxy enabled, the download itself is routed
 * through that proxy (so censored subscription URLs still load), then routing is
 * restored. This is the "test/load through the current working proxy" feature.
 * @param {string} url
 * @param {object} options
 * @param {string} [options.protocol='HTTPS']
 * @param {number} [options.limit=0]
 * @param {boolean} [options.viaActiveProxy=false]
 * @param {number} [options.timeout=25000]
 * @returns {Promise<Array<{name: string, protocol: string, uri: string}>>}
 */
export const fetchProxyList = async (url, {
  protocol = 'HTTPS',
  limit = 0,
  viaActiveProxy = false,
  timeout = 25000,
} = {}) => {
  let routedThroughProxy = false

  if (viaActiveProxy && (await ProxyManager.isEnabled())) {
    const host = extractHostnameFromUrl(url)
    const rules = await ProxyManager.getProxyingRules()

    if (host && rules.proxyServerURI) {
      const token = ProxyManager.toPacToken({
        protocol: rules.proxyServerProtocol,
        uri: rules.proxyServerURI,
      })

      routedThroughProxy = await ProxyManager.applyCheckerPac({ [host]: token })
      // Give the browser a moment to pick up the temporary PAC.
      await new Promise((resolve) => setTimeout(resolve, 150))
    }
  }

  try {
    const response = await fetchWithTimeout(url, {
      timeout,
      cache: 'no-store',
    })

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`)
    }

    const text = await response.text()

    return parseSubscription(text, protocol, limit)
  } finally {
    if (routedThroughProxy) {
      await ProxyManager.restoreNormalProxy()
    }
  }
}
