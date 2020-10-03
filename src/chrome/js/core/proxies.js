import asynchrome from './asynchrome'
import registry from './registry'
import settings from './settings'

class Proxies {
  constructor () {
    this.ignoredDomains = new Set([
      'youtube.com',
    ])

    setInterval(async () => {
      await this.removeOutdatedBlockedDomains()
    }, 60 * 1000 * 60 * 60 * 2)
  }

  excludeIgnoredDomains = (domains) => {
    return domains.filter((domain) => {
      return !Array.from(this.ignoredDomains).includes(domain)
    })
  }

  setProxy = async () => {
    let domains = await registry.getDomains()

    domains = this.excludeIgnoredDomains(domains)

    const config = {
      value: {
        mode: 'pac_script',
        pacScript: {
          data: this.generatePacScriptData(domains),
          mandatory: false,
        },
      },
      scope: 'regular',
    }

    await this.allowProxying()
    await asynchrome.proxy.settings.set(config).catch(console.error)
    console.warn('PAC has been set successfully!')
  }

  /**
   * ATTENTION: DO NOT MODIFY THIS FUNCTION!
   * @param domains An array of domains.
   * @returns {string} The PAC data.
   */
  generatePacScriptData = (domains = []) => {
    // The binary search works only with pre-sorted array.
    domains.sort()

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

  // Return result
  if (isHostBlocked(domains, host)) {
    return 'HTTPS ${settings.getProxyServerUrl()};';
  } else {
    return 'DIRECT';
  }
}`
  }

  removeProxy = async () => {
    await asynchrome.proxy.settings.clear({ scope: 'regular' }).catch(console.error)
    console.warn('Proxy auto-config data cleaned!')
  }

  allowProxying = () => {
    const request = new XMLHttpRequest()
    const proxyServerUrl = 'https://163.172.211.183:39263'

    request.open('GET', proxyServerUrl, true)
    request.addEventListener('error', (_error) => {
      console.error('Error on opening port')
    })
    request.send(null)
  }

  removeOutdatedBlockedDomains = async () => {
    const monthInSeconds = 2628000
    let { blockedDomains } = await asynchrome.storage.local.get({ blockedDomains: [] })

    if (blockedDomains) {
      blockedDomains = blockedDomains.filter((item) => {
        const timestamp = new Date().getTime()

        return (timestamp - item.timestamp) / 1000 < monthInSeconds
      })
    }

    await asynchrome.storage.local.set({ blockedDomains })
    console.warn('Outdated domains has been removed.')
    await this.setProxy()
  }
}

export default new Proxies()
