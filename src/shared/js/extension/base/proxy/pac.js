import { binaryContains } from '../../../utilities'

/**
 * Return PAC Script data.
 * @param domains {Array<string>} - List of domains to proxy.
 * @param proxyServerURI {string} - URI of the proxy server.
 * @param proxyServerProtocol {string} - Protocol of the proxy server.
 * @returns {string} PAC script
 */
export const getPacScript = (
  {
    domains = [],
    proxyServerURI,
    proxyServerProtocol,
    countryCode,
  },
) => {
  return `
  function FindProxyForURL(url, host) {
    const binaryContains = ${binaryContains}

    // Remove ending dot
    if (host.endsWith('.')) {
      host = host.substring(0, host.length - 1);
    }

    // Proxy Ukrainian domains from Russia 
    if ('${countryCode}' === 'RU' && host.substring(host.lastIndexOf('.') + 1) === 'ua') {
      return '${proxyServerProtocol} ${proxyServerURI};';
    }

    // Proxy *.onion and *.i2p domains.
    if (shExpMatch(host, '*.onion') || shExpMatch(host, '*.i2p')) {
      return '${proxyServerProtocol} ${proxyServerURI};';
    }
  
    let isHostBlocked = false;
    const domainLevel = host.split('.').length;
    
    // Domains, which are blocked.
    let domains = ${JSON.stringify(domains)};
  
    // Slice a host, so its level matches level of one in registry
    for (let i=domainLevel; i > 1; i--) {
      if (domainLevel - i) {
        host = host.substring(host.indexOf('.') + 1);
      }
      if (binaryContains(domains['blockedDomainsOfLevel' + i], host)) {
        isHostBlocked = true;
        break;
      }
    }
  
    // Return result
    if (isHostBlocked) {
      return '${proxyServerProtocol} ${proxyServerURI};';
    } else {
      return 'DIRECT';
    }
  }`
}
