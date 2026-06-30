import { proxyToPacToken } from './utilities'

/**
 * Return PAC Script data.
 * @param domains {Array<string>} - List of domains to proxy.
 * @param proxyServerURI {string} - URI of the proxy server.
 * @param proxyServerProtocol {string} - Protocol of the proxy server.
 * @param testRoutes {Object<string, string>|null} - Optional map of
 *   destination host -> PAC return string (e.g. "SOCKS5 1.2.3.4:1080").
 *   Used by the proxy checker to route specific connectivity endpoints through
 *   the proxy currently being tested, while every other request keeps flowing
 *   through the user's active proxy (so browsing never drops during a check).
 * @returns {string} PAC script
 */
export const getPacScript = (
  {
    domains = [],
    proxyServerURI,
    proxyServerProtocol,
    testRoutes = null,
  },
) => {
  // Sort domains alphabetically to make binary search work.
  domains.sort()

  const testRoutesLiteral =
    testRoutes && Object.keys(testRoutes).length > 0
      ? JSON.stringify(testRoutes)
      : 'null'

  // PAC needs "PROXY" for plain HTTP proxies; HTTPS/SOCKS keep their names.
  const proxyToken = proxyServerURI
    ? proxyToPacToken(proxyServerProtocol, proxyServerURI)
    : `${proxyServerProtocol} ${proxyServerURI}`

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
        // full host so each connectivity endpoint can be sent through the exact
        // proxy currently being tested.
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
          return '${proxyToken};';
        }

        // Return result
        if (isHostBlocked(domains, host)) {
          return '${proxyToken};';
        } else {
          return 'DIRECT';
        }
      }`
}
