import { registry, storage } from '.'
import { BrowserAPI } from './browser'

const PRIVATE_BROWSING_PERMISSION_REQUIRED_MSG = 'proxy.settings requires private browsing permission.'

class Proxy extends BrowserAPI {
  constructor () {
    super()
    this.proxyConfig = {
      port: 33333,
      host: 'proxy.roskomsvoboda.org',
      ping: {
        url: 'http://proxy.roskomsvoboda.org:39263',
        timeout: (60 * 3) * 1000,
      },
      resetTimeout: (60 * 60) * 5000,
    }

    setInterval(async () => {
      const proxyingEnabled = await this.proxyingEnabled()

      if (proxyingEnabled) {
        await this.setProxy()
      }
    }, this.proxyConfig.resetTimeout)

    setInterval(() => {
      this.allowProxying()
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

  requiresPrivateBrowsingPermissions = async () => {
    const { privateWindowsPermissionRequired } =
      await storage.get({ privateWindowsPermissionRequired: false })

    return privateWindowsPermissionRequired
  }

  updatePrivateBrowsingPermissionsBadge = async () => {
    if (this.isFirefox) {
      if (await this.requiresPrivateBrowsingPermissions()) {
        await browser.browserAction.setBadgeText({ text: '✕' })
      } else {
        await browser.browserAction.setBadgeText({ text: '' })
      }
    }
  }

  requestPrivateBrowsingPermissions = async () => {
    if (this.isFirefox) {
      await storage.set({ privateWindowsPermissionRequired: true })
      await this.updatePrivateBrowsingPermissionsBadge()
      console.log('Requested private browsing permissions.')
    }
  }

  privateBrowsingPermissionsGranted = async () => {
    if (this.isFirefox) {
      await storage.set({ privateWindowsPermissionRequired: false })
      await this.updatePrivateBrowsingPermissionsBadge()
      console.log('Private browsing permissions granted!')
    }
  }

  setProxy = async () => {
    const config = {}
    const pacData = await this.generateProxyAutoConfigData()

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
      if (error.message === PRIVATE_BROWSING_PERMISSION_REQUIRED_MSG) {
        await this.requestPrivateBrowsingPermissions()
      }
      return false
    }
  }

  /**
   * ATTENTION: DO NOT MODIFY THIS FUNCTION!
   * @returns {string} The PAC data.
   */
  generateProxyAutoConfigData = async () => {
    const domains = await registry.getDomains()

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

  allowProxying = () => {
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
