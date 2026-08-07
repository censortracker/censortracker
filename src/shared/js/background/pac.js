import { proxyToPacToken } from './utilities'

/**
 * Converts an internationalized host to its Punycode (ASCII) form.
 *
 * The URL parser does the IDNA work, so no punycode dependency is needed. A
 * value the parser rejects is returned unchanged when it is already ASCII, and
 * dropped when it is not — an unconvertible Unicode entry could only poison
 * the PAC.
 * @param domain {string} Host, possibly internationalized.
 * @returns {string} ASCII host, or '' when the value is unusable.
 */
const toPunycode = (domain) => {
  if (typeof domain !== 'string' || !domain) {
    return ''
  }

  if (isAscii(domain)) {
    return domain
  }

  try {
    const { hostname } = new URL(`http://${domain}`)

    return isAscii(hostname) ? hostname : ''
  } catch (error) {
    return ''
  }
}

const isAscii = (value) => {
  // eslint-disable-next-line no-control-regex
  return !/[^\u0000-\u007F]/.test(value)
}

/**
 * Escapes every non-ASCII character as a \uXXXX sequence.
 *
 * Chromium refuses a PAC script that is not pure ASCII. Domains are already
 * converted, but a proxy address or a checker route could still carry a
 * non-ASCII character, and a rejected PAC disables proxying entirely — so the
 * finished script gets one last pass. The escapes are valid inside the JS
 * string literals they appear in, so behaviour is unchanged.
 * @param source {string} PAC script source.
 * @returns {string} The same script, ASCII-only.
 */
const toAsciiSource = (source) => {
  // eslint-disable-next-line no-control-regex
  return source.replace(/[^\u0000-\u007F]/g, (char) => {
    return `\\u${char.charCodeAt(0).toString(16).padStart(4, '0')}`
  })
}

/**
 * Return PAC Script data.
 *
 * When several proxies are selected they are *load-balanced*, not merely listed
 * for failover. A plain PAC list ("A; B; C") makes the browser always use A and
 * only fall back to B/C when A is unreachable — so with a working first proxy
 * the rest are never touched. Instead we hash the destination host to pick a
 * primary proxy per site (consistent for that site, so sessions don't break)
 * and append the remaining proxies as automatic fallbacks. Across many sites
 * every selected proxy gets used.
 *
 * NOTE: this is distribution + failover, NOT true multi-hop ("onion") routing
 * where traffic flows *through* proxy A and then B — that's impossible with a
 * browser PAC and needs an external relay.
 *
 * @param domains {Array<string>} - List of domains to proxy.
 * @param proxies {Array<{protocol: string, uri: string}>} - Selected proxies,
 *   load-balanced per destination. Takes precedence when present.
 * @param proxyServerURI {string} - URI of a single proxy server (legacy).
 * @param proxyServerProtocol {string} - Protocol of a single proxy (legacy).
 * @param testRoutes {Object<string, string>|null} - Optional map of
 *   destination host -> PAC return token. Used by the proxy checker to send
 *   specific connectivity endpoints through the proxy being tested, while every
 *   other request keeps following the rules below (so browsing never drops).
 * @param proxyAll {boolean} - When true, EVERY destination (except local and
 *   private ones) is sent through the selected proxies, not only the domains
 *   from the registry/custom list.
 * @returns {string} PAC script
 */
export const getPacScript = (
  {
    domains = [],
    proxies = null,
    proxyServerURI,
    proxyServerProtocol,
    testRoutes = null,
    proxyAll = false,
  },
) => {
  // Chromium rejects a PAC containing non-ASCII outright ("'pacScript.data'
  // supports only ASCII code"), which fails the whole setProxy() call. It also
  // hands FindProxyForURL the Punycode form of an internationalized host, so a
  // Unicode entry in the blocklist could never match one anyway. Converting
  // here fixes both at once.
  const asciiDomains = domains
    .map((domain) => toPunycode(domain))
    .filter(Boolean)

  // Sort AFTER conversion: the PAC looks entries up with a binary search, so
  // the array has to be ordered by the values actually compared at runtime.
  asciiDomains.sort()

  // Accept either an explicit list of proxies or a single legacy pair.
  let list = []

  if (Array.isArray(proxies) && proxies.length > 0) {
    list = proxies
  } else if (proxyServerURI) {
    list = [{ protocol: proxyServerProtocol, uri: proxyServerURI }]
  }

  const proxyTokens = list
    .filter((proxy) => proxy && proxy.protocol && proxy.uri)
    .map(({ protocol, uri }) => proxyToPacToken(protocol, uri))

  // Precompute every rotation of the proxy list ("B; C; A;" etc.) here, at
  // generation time. There are only N of them, and it saves FindProxyForURL
  // from rebuilding the failover string (two slices, a concat and a join) on
  // every single request.
  const proxyRotations = proxyTokens.map((token, index) => {
    const rotation = proxyTokens
      .slice(index)
      .concat(proxyTokens.slice(0, index))
      .join('; ')

    return `${rotation};`
  })

  const testRoutesLiteral =
    testRoutes && Object.keys(testRoutes).length > 0
      ? JSON.stringify(testRoutes)
      : 'null'

  // Everything heavy (the blocklist array, the rotation strings, the helpers)
  // lives at the top level of the PAC script: it is evaluated ONCE when the
  // browser loads the script. Only FindProxyForURL runs per request — keeping
  // per-request work down to a hash and a binary search, with no allocations.
  return toAsciiSource(`
      // Domains, which are blocked.
      var domains = ${JSON.stringify(asciiDomains)};

      // Load-balanced proxy orders: one failover string per rotation. The host
      // hash picks a primary (stable per site), the rest follow as fallbacks.
      var proxyRotations = ${JSON.stringify(proxyRotations)};

      // Proxy-checker test routes: full host -> PAC return token.
      var testRoutes = ${testRoutesLiteral};

      // When true, everything except local/private destinations is proxied.
      var proxyAll = ${proxyAll ? 'true' : 'false'};

      function isHostBlocked(array, target) {
        var left = 0;
        var right = array.length - 1;

        while (left <= right) {
          var mid = left + Math.floor((right - left) / 2);

          if (array[mid] === target) {
            return true;
          }

          if (array[mid] < target) {
            left = mid + 1;
          } else {
            right = mid - 1;
          }
        }
        return false;
      }

      function pickProxy(target) {
        if (proxyRotations.length === 0) {
          return 'DIRECT';
        }
        var sum = 0;
        for (var i = 0; i < target.length; i++) {
          sum = (sum * 31 + target.charCodeAt(i)) % 2147483647;
        }
        return proxyRotations[sum % proxyRotations.length];
      }

      function FindProxyForURL(url, host) {
        // Remove ending dot
        if (host.endsWith('.')) {
          host = host.substring(0, host.length - 1);
        }

        // Proxy-checker test routes take precedence and are matched against the
        // full host so each connectivity endpoint goes through the exact proxy
        // currently being tested.
        if (testRoutes && Object.prototype.hasOwnProperty.call(testRoutes, host)) {
          return testRoutes[host];
        }

        // Proxy-all mode: send everything through the selected proxies,
        // keeping local and private destinations direct.
        if (proxyAll) {
          if (
            isPlainHostName(host) ||
            shExpMatch(host, 'localhost') ||
            shExpMatch(host, '*.local') ||
            shExpMatch(host, '127.*') ||
            shExpMatch(host, '10.*') ||
            shExpMatch(host, '192.168.*') ||
            // 172.16.0.0/12. Only '*' and '?' are portable across PAC
            // engines, so the range is spelled out rather than written as a
            // character class: '172.2?.' matches exactly 172.20-172.29 and
            // never the public 172.2.x.x.
            shExpMatch(host, '172.16.*') ||
            shExpMatch(host, '172.17.*') ||
            shExpMatch(host, '172.18.*') ||
            shExpMatch(host, '172.19.*') ||
            shExpMatch(host, '172.2?.*') ||
            shExpMatch(host, '172.30.*') ||
            shExpMatch(host, '172.31.*') ||
            // Link-local (169.254.0.0/16) — DHCP failure and cloud metadata.
            shExpMatch(host, '169.254.*') ||
            host === '0.0.0.0' ||
            host === '::1' ||
            // IPv6 unique-local (fc00::/7) and link-local (fe80::/10).
            shExpMatch(host, 'fc??:*') ||
            shExpMatch(host, 'fd??:*') ||
            shExpMatch(host, 'fe80:*')
          ) {
            return 'DIRECT';
          }
          return pickProxy(host);
        }

        // Make domain second-level.
        var lastDot = host.lastIndexOf('.');
        if (lastDot !== -1) {
          lastDot = host.lastIndexOf('.', lastDot - 1);
          if (lastDot !== -1) {
            host = host.substr(lastDot + 1);
          }
        }

        // Proxy *.onion and *.i2p domains.
        if (shExpMatch(host, '*.onion') || shExpMatch(host, '*.i2p')) {
          return pickProxy(host);
        }

        // Return result
        if (isHostBlocked(domains, host)) {
          return pickProxy(host);
        } else {
          return 'DIRECT';
        }
      }`)
}
