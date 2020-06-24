import { chromeProxySettingsSet, chromeProxySettingsClear } from '../promises'
import db from './database'
import registry from './registry'
import settings from './settings'

class Proxies {
  constructor () {
    this.ignoredDomains = new Set([
      'youtube.com',
      'tunnelbear.com',
    ])
    chrome.proxy.onProxyError.addListener((details) => {
      console.error(`Proxy error: ${JSON.stringify(details)}`)
    })

    setInterval(() => {
      this.removeOutdatedBlockedDomains()
    }, 60 * 1000 * 60 * 60 * 2)
  }

  addDomainToIgnore = (domain) => {
    this.ignoredDomains.add(domain)
  }

  ignoredDomainsContains = (domain) => {
    return Array.from(this.ignoredDomains).includes(domain)
  }

  excludeIgnoredDomains = (domains) => {
    return domains.filter((domain) => {
      return !this.ignoredDomainsContains(domain)
    })
  }

  setProxy = async (hostname) => {
    let domains = await registry.getDomains()

    domains = this.excludeIgnoredDomains(domains)

    const { blockedDomains } = await db.get({ blockedDomains: [] })

    if (hostname) {
      const domainInBlocked = blockedDomains
        .find(({ domain }) => domain === hostname)

      if (!domainInBlocked) {
        blockedDomains.push({
          domain: hostname,
          timestamp: new Date().getTime(),
        })
      }
    }

    if (blockedDomains) {
      domains = domains.concat(blockedDomains.map(({ domain }) => domain))
    }

    await db.set('blockedDomains', blockedDomains)

    if (hostname) {
      console.log(
        `Site ${hostname} has been added to set of blocked by DPI.`,
      )
    }

    await this.setProxyAutoConfig(domains)
  }

  setProxyAutoConfig = async (domains) => {
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

    await chromeProxySettingsSet(config).catch(console.error)
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

    const http = settings.getProxyServerUrl({ ssl: false })
    const https = settings.getProxyServerUrl({ ssl: true })

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
    return 'HTTPS ${https}; PROXY ${http};';
  } else {
    return 'DIRECT';
  }
}`
  }

  removeProxy = async () => {
    await chromeProxySettingsClear({ scope: 'regular' }).catch(console.error)
    console.warn('Proxy auto-config disabled!')
  }

  openPorts = () => {
    console.log('Sending ping to port...')
    const proxyServerUrl = 'https://163.172.211.183:39263'
    const xhr = new XMLHttpRequest()

    xhr.open('GET', proxyServerUrl, true)
    xhr.addEventListener('error', (e) => {
      console.error(`Error on opening ports: ${e}`)
    })
    xhr.send(null)

    setTimeout(() => {
      xhr.abort()
    }, 3000)
  }

  removeOutdatedBlockedDomains = async () => {
    const monthInSeconds = 2628000
    let { blockedDomains } = await db.get('blockedDomains')

    if (blockedDomains) {
      blockedDomains = blockedDomains.filter((item) => {
        const timestamp = new Date().getTime()

        return (timestamp - item.timestamp) / 1000 < monthInSeconds
      })
    }

    await db.set('blockedDomains', blockedDomains)
    console.warn('Outdated domains has been removed.')
    await this.setProxy()
  }
}

export default new Proxies()
