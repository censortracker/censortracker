import { proxyToPacToken } from './utilities'

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
 * @returns {string} PAC script
 */
export const getPacScript = (
  {
    domains = [],
    proxies = null,
    proxyServerURI,
    proxyServerProtocol,
    testRoutes = null,
  },
) => {
  // Sort domains alphabetically to make binary search work.
  domains.sort()

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

  const proxyTokensLiteral = JSON.stringify(proxyTokens)

  const testRoutesLiteral =
    testRoutes && Object.keys(testRoutes).length > 0
      ? JSON.stringify(testRoutes)
      : 'null'

  return `
      function FindProxyForURL(url, host) {
        function isHostBlocked(array, target) {
          let left = 0;
          let right = array.length - 1;

          while (left <= right) {
            const mid = left + Math.floor((right - left) / 2);

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

        // Load-balance the selected proxies across destinations: hash the host
        // to choose a primary, then append the rest as failover. One site
        // always maps to the same primary (stable sessions), but different
        // sites spread across every selected proxy.
        var proxyTokens = ${proxyTokensLiteral};
        function pickProxy(target) {
          if (!proxyTokens || proxyTokens.length === 0) {
            return 'DIRECT';
          }
          var sum = 0;
          for (var i = 0; i < target.length; i++) {
            sum = (sum * 31 + target.charCodeAt(i)) % 2147483647;
          }
          var start = sum % proxyTokens.length;
          var ordered = proxyTokens.slice(start).concat(proxyTokens.slice(0, start));
          return ordered.join('; ') + ';';
        }

        // Remove ending dot
        if (host.endsWith('.')) {
          host = host.substring(0, host.length - 1);
        }

        // Proxy-checker test routes take precedence and are matched against the
        // full host so each connectivity endpoint goes through the exact proxy
        // currently being tested.
        const testRoutes = ${testRoutesLiteral};
        if (testRoutes && Object.prototype.hasOwnProperty.call(testRoutes, host)) {
          return testRoutes[host];
        }

        // Make domain second-level.
        let lastDot = host.lastIndexOf('.');
        if (lastDot !== -1) {
          lastDot = host.lastIndexOf('.', lastDot - 1);
          if (lastDot !== -1) {
            host = host.substr(lastDot + 1);
          }
        }

        // Domains, which are blocked.
        let domains = ${JSON.stringify(domains)};

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
      }`
}
