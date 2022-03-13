import axios from 'axios'

import { registry, storage } from '.'
import { Browser } from './browser'

const PROXY_CONFIG_API_URL = 'https://app.censortracker.org/api/proxy-config/'
const REFRESH_PAC_TIMEOUT = 60 * 20 * 1000 // Every 20 minutes
const FETCH_CONFIG_TIMEOUT = 60 * 5 * 1000 // Every 5 minutes
const FALLBACK_PROXY_SERVER_HOST = 'proxy.roskomsvoboda.org'
const FALLBACK_PROXY_SERVER_PORT = 33333
const FALLBACK_PROXY_SERVER_URL = `${FALLBACK_PROXY_SERVER_HOST}:${FALLBACK_PROXY_SERVER_PORT}`
const FALLBACK_PROXY_SERVER_PING_URL = `http://${FALLBACK_PROXY_SERVER_HOST}:39263`

class Proxy extends Browser {
  constructor () {
    super()

    setInterval(async () => {
      const proxyingEnabled = await this.proxyingEnabled()

      if (proxyingEnabled) {
        await this.setProxy()
      }
    }, REFRESH_PAC_TIMEOUT)

    setInterval(async () => {
      await this.fetchReserveConfig()
    }, FETCH_CONFIG_TIMEOUT)
  }

  fetchReserveConfig = async () => {
    try {
      const {
        data: {
          server,
          port,
          pingHost,
          pingPort,
        } = {},
      } = await axios.get(PROXY_CONFIG_API_URL)

      if (server && port && pingHost && pingPort) {
        await storage.set({
          reserveProxyPingURI: `${pingHost}:${pingPort}`,
          reserveProxyServerURI: `${server}:${port}`,
        })
        console.warn('Reserve proxy fetched!')
      } else {
        console.warn('Reverse proxy is not provided.')
      }
    } catch (error) {
      const fetchTimeout = new Date(FETCH_CONFIG_TIMEOUT)

      console.error(
        `Error on fetching reverse proxy: trying again in ${fetchTimeout.getMinutes()} minutes...`,
      )
    }
  }

  getProxyServerURI = async () => {
    await this.fetchReserveConfig()
    const { customProxyServerURI, reserveProxyServerURI } =
      await storage.get([
        'customProxyServerURI',
        'reserveProxyServerURI',
      ])

    if (customProxyServerURI) {
      console.warn('Using custom proxy for PAC.')
      return customProxyServerURI
    }

    if (reserveProxyServerURI) {
      console.warn('Using reserve proxy for PAC.')
      return reserveProxyServerURI
    }
    console.log('Using fallback proxy for PAC.')
    return FALLBACK_PROXY_SERVER_URL
  }

  requestIncognitoAccess = async () => {
    if (this.isFirefox) {
      await this.browser.browserAction.setBadgeText({ text: '✕' })
      await storage.set({ privateBrowsingPermissionsRequired: true })
      console.log('Private browsing permissions requested.')
    }
  }

  grantIncognitoAccess = async () => {
    if (this.isFirefox) {
      await this.browser.browserAction.setBadgeText({ text: '' })
      await storage.set({ privateBrowsingPermissionsRequired: false })
      console.log('Private browsing permissions granted.')
    }
  }

  setProxy = async () => {
    const config = {}
    const pacData = await this.generateProxyAutoConfigData()

    if (!pacData) {
      console.warn('Local registry is empty: cannot set PAC')
      return false
    }

    if (this.isFirefox) {
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
      await this.browser.proxy.settings.set(config)
      await this.enableProxy()
      await this.ping()
      console.log('PAC has been generated and set successfully!')
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
  generateProxyAutoConfigData = async () => {
    const domains = await registry.getDomains()

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
          return 'HTTPS ${await this.getProxyServerURI()};';
        } else {
          return 'DIRECT';
        }
      }`
  }

  removeProxy = async () => {
    await storage.set({ useProxy: false })
    await this.browser.proxy.settings.clear({})
    console.warn('PAC data cleaned!')
  }

  alive = async () => {
    return true
  }

  ping = async () => {
    const request = new XMLHttpRequest()
    const { reserveProxyPingURI } = await storage.get({
      reserveProxyPingURI: FALLBACK_PROXY_SERVER_PING_URL,
    })

    try {
      request.open('GET', `http://${reserveProxyPingURI}`, true)
      request.send(null)
      console.warn(`Ping ${reserveProxyPingURI}`)
    } catch (error) {
      console.log(error)
    }
  }

  proxyingEnabled = async () => {
    const { useProxy } = await storage.get({ useProxy: true })

    return useProxy
  }

  enableProxy = async () => {
    console.log('Proxying enabled.')
    await storage.set({
      useProxy: true,
    })
  }

  disableProxy = async () => {
    console.warn('Proxying disabled.')
    await storage.set({
      useProxy: false,
    })
  }

  controlledByOtherExtensions = async () => {
    const { levelOfControl } = await this.browser.proxy.settings.get({})

    return levelOfControl === 'controlled_by_other_extensions'
  }

  controlledByThisExtension = async () => {
    const { levelOfControl } = await this.browser.proxy.settings.get({})

    return levelOfControl === 'controlled_by_this_extension'
  }

  debugging = async () => {
    await this.removeProxy()
    console.warn('Debug mode enabled')
  }
}

export default new Proxy()
