import Registry from './registry'
import * as storage from './storage'
import Browser from './webextension'

const PROXY_CONFIG_API_ENDPOINT = 'https://app.censortracker.org/api/proxy-config/'
const FALLBACK_PROXY_SERVER_HOST = 'proxy.roskomsvoboda.org'
const FALLBACK_PROXY_SERVER_URI = `${FALLBACK_PROXY_SERVER_HOST}:33333`
const FALLBACK_PROXY_SERVER_PING_URI = `${FALLBACK_PROXY_SERVER_HOST}:39263`

class ProxyManager {
  async fetchReserveConfig () {
    try {
      const { proxyAPIEndpoint } = await storage.get({
        proxyAPIEndpoint: PROXY_CONFIG_API_ENDPOINT,
      })
      const response = await fetch(proxyAPIEndpoint)
      const { server, port, pingHost, pingPort } = await response.json()

      if (server && port && pingHost && pingPort) {
        const reserveProxyPingURI = `${pingHost}:${pingPort}`
        const reserveProxyServerURI = `${server}:${port}`

        console.warn(`Proxy fetched: ${reserveProxyServerURI}!`)

        await storage.set({ reserveProxyPingURI, reserveProxyServerURI })

        return { reserveProxyServerURI }
      }
      console.warn('Reverse proxy is not provided.')
    } catch (error) {
      console.error(
        'Error on fetching proxy: trying again in 10 minutes...',
      )
    }
    return {}
  }

  async getProxyServerURI () {
    const { reserveProxyServerURI } = await this.fetchReserveConfig()
    const { customProxyServerURI } = await storage.get(['customProxyServerURI'])

    if (customProxyServerURI) {
      console.warn('Using custom proxy for PAC.')
      return customProxyServerURI
    }

    if (reserveProxyServerURI) {
      console.warn('Using reserve proxy for PAC.')
      return reserveProxyServerURI
    }
    console.log('Using fallback proxy for PAC.')
    return FALLBACK_PROXY_SERVER_URI
  }

  async requestIncognitoAccess () {
    if (Browser.IS_FIREFOX) {
      const isAllowedIncognitoAccess =
        await Browser.extension.isAllowedIncognitoAccess()

      if (!isAllowedIncognitoAccess) {
        await Browser.browserAction.setBadgeText({ text: '✕' })
        await storage.set({ privateBrowsingPermissionsRequired: true })
        console.info('Private browsing permissions requested.')
      } else {
        console.log('Private browsing permissions already granted.')
      }
    }
  }

  async grantIncognitoAccess () {
    if (Browser.IS_FIREFOX) {
      await Browser.browserAction.setBadgeText({ text: '' })
      await storage.set({ privateBrowsingPermissionsRequired: false })
      console.info('Private browsing permissions granted.')
    }
  }

  async setProxy () {
    const config = {}
    const pacData = await this.generateProxyAutoConfigData()

    if (!pacData) {
      console.warn('Cannot set proxy: local database is empty')
      return false
    }

    if (Browser.IS_FIREFOX) {
      const blob = new Blob([pacData], {
        type: 'application/x-ns-proxy-autoconfig',
      })

      config.value = {
        proxyType: 'autoConfig',
        autoConfigUrl: URL.createObjectURL(blob),
      }
    } else {
      config.scope = 'regular'
      config.value = {
        mode: 'pac_script',
        pacScript: {
          data: pacData,
          mandatory: false,
        },
      }
    }

    try {
      await Browser.proxy.settings.set(config)
      await this.enableProxy()
      await this.grantIncognitoAccess()
      console.warn('PAC has been generated and set successfully!')
      return true
    } catch (error) {
      await this.disableProxy()
      await this.requestIncognitoAccess()
      return false
    }
  }

  /**
   * ATTENTION: DO NOT MODIFY THIS FUNCTION!
   */
  async generateProxyAutoConfigData () {
    const domains = await Registry.getDomains()
    const proxyServerURI = await this.getProxyServerURI()

    await storage.set({ proxyServerURI })

    if (domains.length === 0) {
      return undefined
    }

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
          return 'HTTPS ${proxyServerURI};';
        } else {
          return 'DIRECT';
        }
      }`
  }

  async removeProxy () {
    await storage.set({ useProxy: false })
    await Browser.proxy.settings.clear({})
    console.warn('PAC data cleaned!')
  }

  async alive () {
    const { proxyIsAlive } =
      await storage.get({ proxyIsAlive: true })

    return proxyIsAlive
  }

  async ping () {
    const { reserveProxyPingURI } = await storage.get({
      reserveProxyPingURI: FALLBACK_PROXY_SERVER_PING_URI,
    })

    fetch(`http://${reserveProxyPingURI}`, {
      method: 'POST',
      headers: {
        'Content-type': 'application/json; charset=UTF-8',
      },
      body: JSON.stringify({
        type: 'ping',
      }),
    }).catch(() => {
      // We don't care about the result.
      console.warn(`Pinged ${reserveProxyPingURI}!`)
    })
  }

  async isEnabled () {
    const { useProxy } = await storage.get({ useProxy: true })

    return useProxy
  }

  async enableProxy () {
    console.log('Proxying enabled.')
    await storage.set({ useProxy: true, proxyIsAlive: true })
  }

  async disableProxy () {
    console.warn('Proxying disabled.')
    await storage.set({ useProxy: false })
  }

  async controlledByOtherExtensions () {
    const { levelOfControl } = await Browser.proxy.settings.get({})

    return levelOfControl === 'controlled_by_other_extensions'
  }

  async controlledByThisExtension () {
    const { levelOfControl } = await Browser.proxy.settings.get({})

    return levelOfControl === 'controlled_by_this_extension'
  }
}

export default new ProxyManager()
