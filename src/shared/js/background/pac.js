import { proxyToPacToken } from './utilities'

/**
 * Build the PAC "return" directive from one or more proxies.
 *
 * A PAC script can list several proxies separated by ";". The browser then
 * tries them one after another (failover): the first reachable one wins, the
 * rest are fallbacks. This is what powers the "proxy chain" feature — the user
 * marks several proxies and they are tried in order.
 *
 * NOTE: PAC cannot do true multi-hop ("onion") routing where traffic flows
 * *through* proxy A and *then* B; that requires an external relay. Here the
 * chain means "use these proxies one after another".
 *
 * @param {Array<{protocol: string, uri: string}>} list - Ordered proxies.
 * @returns {string} e.g. "SOCKS5 1.2.3.4:1080; HTTPS 5.6.7.8:8443"
 */
const buildProxyDirective = (list) => {
  return list
    .filter((proxy) => proxy && proxy.protocol && proxy.uri)
    .map(({ protocol, uri }) => proxyToPacToken(protocol, uri))
    .join('; ')
}

/**
 * Return PAC Script data.
 * @param domains {Array<string>} - List of domains to proxy.
 * @param proxies {Array<{protocol: string, uri: string}>} - Ordered proxy
 *   chain. Tried one after another (failover). Takes precedence when present.
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

  // Accept either an explicit proxy chain or a single legacy pair.
  let list = []

  if (Array.isArray(proxies) && proxies.length > 0) {
    list = proxies
  } else if (proxyServerURI) {
    list = [{ protocol: proxyServerProtocol, uri: proxyServerURI }]
  }

  const directive = buildProxyDirective(list)
  // When there is no proxy configured, never accidentally return an empty
  // string (which is an invalid PAC result): fall back to DIRECT instead.
  const proxyResult = directive ? `'${directive};'` : '\'DIRECT\''

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
          return ${proxyResult};
        }

        // Return result
        if (isHostBlocked(domains, host)) {
          return ${proxyResult};
        } else {
          return 'DIRECT';
        }
      }`
}
