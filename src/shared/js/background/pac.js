import {
  buildIgnoreIndex,
  isIgnoredHost,
  isPrivateHost,
  toPunycode,
} from './host-rules'
import { proxyToPacToken } from './utilities'

// Re-exported because a good deal of the extension already reaches for it
// here. The definition sits next to the rest of the host classification.
export { toPunycode }

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
 * @param ignoredHosts {Array<string>} - The user's "Ignored sites" list. These
 *   never go through a proxy, in any mode — including proxy-all, where there is
 *   no blocklist for them to be filtered out of.
 * @returns {string} PAC script
 */
/**
 * Second-level form of a host — the same truncation FindProxyForURL applies
 * before matching the blocklist, so rules key off exactly what the PAC does.
 * @param host {string}
 * @returns {string}
 */
export const toSecondLevel = (host) => {
  const value = String(host || '').replace(/\.$/, '')
  let lastDot = value.lastIndexOf('.')

  if (lastDot === -1) {
    return value
  }
  lastDot = value.lastIndexOf('.', lastDot - 1)

  return lastDot === -1 ? value : value.slice(lastDot + 1)
}

/**
 * The host hash FindProxyForURL uses to pick a primary proxy. Kept identical
 * to the copy inside the generated script — `pac.test` asserts the two agree,
 * because the popup tells the user which proxy a site goes through and a
 * drifting copy would make it lie.
 * @param target {string}
 * @returns {number}
 */
export const hashHost = (target) => {
  let sum = 0

  for (let index = 0; index < target.length; index += 1) {
    sum = (sum * 31 + target.charCodeAt(index)) % 2147483647
  }
  return sum
}

/**
 * Every rotation of a proxy list: entry i starts at proxy i and wraps around,
 * so the host hash picks a primary and the rest follow as fallbacks.
 * @param tokens {Array<string>}
 * @returns {Array<string>}
 */
const buildRotations = (tokens) => {
  return tokens.map((token, index) => {
    return `${tokens.slice(index).concat(tokens.slice(0, index)).join('; ')};`
  })
}

export const getPacScript = (
  {
    domains = [],
    proxies = null,
    proxyServerURI,
    proxyServerProtocol,
    testRoutes = null,
    proxyAll = false,
    proxyCountries = [],
    siteCountryRules = {},
    ignoredHosts = [],
  },
) => {
  // Chromium rejects a PAC containing non-ASCII outright ("'pacScript.data'
  // supports only ASCII code"), which fails the whole setProxy() call. It also
  // hands FindProxyForURL the Punycode form of an internationalized host, so a
  // Unicode entry in the blocklist could never match one anyway. Converting
  // here fixes both at once. Lower-cased for the same reason FindProxyForURL
  // lower-cases the host it is given: the lookup is an exact comparison, so a
  // single odd-cased entry would sit in the list matching nothing.
  const asciiDomains = domains
    .map((domain) => toPunycode(domain).toLowerCase())
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
  const proxyRotations = buildRotations(proxyTokens)

  // Per-site country rules ("never open this site through a NL proxy"). The
  // filtered rotations are precomputed per site too, so enforcing a rule costs
  // FindProxyForURL one property lookup rather than a filter per request.
  //
  // Only proxies whose country is *known* to match are excluded. Treating an
  // unknown country as a match would be the stricter reading, but it would
  // also empty the list for anyone who has not run a check — and an empty list
  // means the site opens directly, i.e. does not open at all when it is
  // blocked. The popup surfaces how many proxies are still unknown instead.
  const countries = list.map((proxy, index) => {
    return String(proxyCountries[index] || '').toUpperCase()
  })
  const siteRotations = {}

  for (const [site, codes] of Object.entries(siteCountryRules || {})) {
    const key = toPunycode(toSecondLevel(site))

    if (!key || !Array.isArray(codes) || codes.length === 0) {
      continue
    }

    const blocked = new Set(codes.map((code) => String(code).toUpperCase()))
    const allowed = proxyTokens.filter((token, index) => {
      return !countries[index] || !blocked.has(countries[index])
    })

    // Only worth embedding when it actually changes the outcome.
    if (allowed.length !== proxyTokens.length) {
      siteRotations[key] = buildRotations(allowed)
    }
  }

  const testRoutesLiteral =
    testRoutes && Object.keys(testRoutes).length > 0
      ? JSON.stringify(testRoutes)
      : 'null'

  // The user's exemptions, reduced to the bare hosts the PAC compares against.
  const ignoreIndex = buildIgnoreIndex(ignoredHosts)

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

      // Per-site overrides: second-level domain -> rotations with the
      // countries that site refuses filtered out. Absent = no rule.
      var siteRotations = ${JSON.stringify(siteRotations)};

      // Proxy-checker test routes: full host -> PAC return token.
      var testRoutes = ${testRoutesLiteral};

      // When true, everything except local/private destinations is proxied.
      var proxyAll = ${proxyAll ? 'true' : 'false'};

      // "Ignored sites": hosts the user asked to keep off the proxy entirely.
      var ignoredHosts = ${JSON.stringify(ignoreIndex)};

      // Embedded from host-rules.js rather than written out again here, so the
      // routing decision and the popup that explains it come from one function.
      var isPrivateHost = ${String(isPrivateHost)};

      var isIgnoredHost = ${String(isIgnoredHost)};

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

      function secondLevel(host) {
        var lastDot = host.lastIndexOf('.');
        if (lastDot === -1) {
          return host;
        }
        lastDot = host.lastIndexOf('.', lastDot - 1);
        return lastDot === -1 ? host : host.substr(lastDot + 1);
      }

      // \`target\` is hashed to pick the primary proxy; \`site\` selects the
      // rule set. They differ in proxy-all mode, where routing is per full
      // host but a country rule still applies to the whole site.
      function pickProxy(target, site) {
        var rotations = proxyRotations;

        if (Object.prototype.hasOwnProperty.call(siteRotations, site)) {
          rotations = siteRotations[site];
        }

        // Every proxy is from a country this site refuses: going direct is the
        // only answer that honours the rule.
        if (rotations.length === 0) {
          return 'DIRECT';
        }
        var sum = 0;
        for (var i = 0; i < target.length; i++) {
          sum = (sum * 31 + target.charCodeAt(i)) % 2147483647;
        }
        return rotations[sum % rotations.length];
      }

      function FindProxyForURL(url, host) {
        // One spelling for everything below: browsers hand over the host in
        // whatever case the URL carried, and a trailing dot names the same host.
        host = host.toLowerCase();

        if (host.charAt(host.length - 1) === '.') {
          host = host.substring(0, host.length - 1);
        }

        // Local and private destinations go out directly in EVERY mode, not
        // only in proxy-all. A remote proxy cannot reach the machine's own
        // network, so proxying 192.168.1.1 does not slow it down — it makes the
        // address unreachable until the extension is turned off.
        if (isPrivateHost(host)) {
          return 'DIRECT';
        }

        // "Ignored sites" is a promise, and nothing below may override it. It
        // used to be kept only by filtering the blocklist, which does nothing
        // in proxy-all mode — there is no blocklist there to filter.
        if (isIgnoredHost(host, ignoredHosts)) {
          return 'DIRECT';
        }

        // Proxy-checker test routes take precedence over the rules and are
        // matched against the full host so each connectivity endpoint goes
        // through the exact proxy currently being tested.
        if (testRoutes && Object.prototype.hasOwnProperty.call(testRoutes, host)) {
          return testRoutes[host];
        }

        // Proxy-all mode: send everything else through the selected proxies.
        // Routing stays per full host here; the rule is looked up by site.
        if (proxyAll) {
          return pickProxy(host, secondLevel(host));
        }

        // Make domain second-level.
        host = secondLevel(host);

        // Proxy *.onion and *.i2p domains.
        if (shExpMatch(host, '*.onion') || shExpMatch(host, '*.i2p')) {
          return pickProxy(host, host);
        }

        // Return result
        if (isHostBlocked(domains, host)) {
          return pickProxy(host, host);
        } else {
          return 'DIRECT';
        }
      }`)
}
