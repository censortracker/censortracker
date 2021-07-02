import { registry, storage } from '.'
import { BrowserAPI } from './browser'

const PROXY_SERVER_DEFAULT_HOST = 'proxy.roskomsvoboda.org'
const PROXY_SERVER_DEFAULT_PORT = 33333
const PROXY_SERVER_DEFAULT_PING_URL = `http://${PROXY_SERVER_DEFAULT_HOST}:39263`
const PROXY_SERVER_DEFAULT_PING_TIMEOUT = (60 * 3) * 1000
const PROXY_DEFAULT_RESET_TIMEOUT = (60 * 60) * 5000
const RSERVE_PROXY_CONFIGS_API_URL = 'https://app.censortracker.org/api/proxy-configs/'

class Proxy extends BrowserAPI {
  constructor () {
    super()
    this.proxyConfig = {
      port: PROXY_SERVER_DEFAULT_PORT,
      host: PROXY_SERVER_DEFAULT_HOST,
      ping: {
        url: PROXY_SERVER_DEFAULT_PING_URL,
        timeout: PROXY_SERVER_DEFAULT_PING_TIMEOUT,
      },
      resetTimeout: PROXY_DEFAULT_RESET_TIMEOUT,
      reserveConfigsUrl: RSERVE_PROXY_CONFIGS_API_URL,
    }

    setInterval(async () => {
      const proxyingEnabled = await this.proxyingEnabled()

      if (proxyingEnabled) {
        await this.setProxy()
      }
    }, this.proxyConfig.resetTimeout)

    setInterval(() => {
      this.ping()
    }, this.proxyConfig.ping.timeout)
  }

  getProxyServerURL = async () => {
    const { customProxyHost, customProxyPort } =
      await storage.get(['customProxyHost', 'customProxyPort'])

    if (customProxyHost && customProxyPort) {
      return `${customProxyHost}:${customProxyPort}`
    }

    return `${this.proxyConfig.host}:${this.proxyConfig.port}`
  }

  requestPrivateBrowsingPermissions = async () => {
    if (this.isFirefox) {
      await storage.set({ privateBrowsingPermissionsRequired: true })
      console.log('Private browsing permissions requested.')
    }
  }

  privateBrowsingPermissionsGranted = async () => {
    if (this.isFirefox) {
      await storage.set({ privateBrowsingPermissionsRequired: false })
      console.log('Private browsing permissions granted.')
    }
  }

  setProxy = async () => {
    const config = {}
    const pacData = await this.generateProxyAutoConfigData()

    if (!pacData) {
      console.warn('Local registry is empty: cannot set PAC')
      return undefined
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
      await this.privateBrowsingPermissionsGranted()
      console.log('PAC has been generated and set successfully!')
      return true
    } catch (error) {
      await this.disableProxy()
      await this.requestPrivateBrowsingPermissions()
      return false
    }
  }

  /**
   * ATTENTION: DO NOT MODIFY THIS FUNCTION!
   * @returns {string} The PAC data.
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
          return 'HTTPS ${await this.getProxyServerURL()};';
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

  ping = () => {
    const request = new XMLHttpRequest()

    request.open('GET', this.proxyConfig.ping.url, true)

    try {
      request.send(null)
    } catch (error) {
      console.log(error)
    }
  }

  proxyingEnabled = async () => {
    const { useProxy } =
      await storage.get({ useProxy: true })

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
    const { levelOfControl } =
      await this.browser.proxy.settings.get({})

    return levelOfControl === 'controlled_by_other_extensions'
  }

  controlledByThisExtension = async () => {
    const { levelOfControl } =
      await this.browser.proxy.settings.get({})

    return levelOfControl === 'controlled_by_this_extension'
  }

  debugging = async () => {
    await storage.set({ domains: [] })
    await this.setProxy()
    console.warn('Debug mode enabled')
  }
}

export default new Proxy()
