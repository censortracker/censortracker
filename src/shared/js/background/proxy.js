import { getPacScript } from 'Background/pac'

import { getConfig, setConfig } from '../config'
import browser from './browser-api'
import registry from './registry'

class ProxyManager {
  async getProxyingRules () {
    const {
      proxyServerURI,
      customProxyProtocol,
      customProxyServerURI,
    } = await getConfig(
      'proxyServerURI',
      'customProxyProtocol',
      'customProxyServerURI',
    )

    if (
      customProxyServerURI &&
      customProxyProtocol
    ) {
      return {
        proxyServerProtocol: customProxyProtocol,
        proxyServerURI: customProxyServerURI,
      }
    }
    return {
      proxyServerProtocol: 'HTTPS',
      proxyServerURI,
    }
  }

  async requestIncognitoAccess () {
    if (browser.isFirefox) {
      const isAllowedIncognitoAccess =
        await browser.extension.isAllowedIncognitoAccess()

      if (!isAllowedIncognitoAccess) {
        await browser.browserAction.setBadgeText({ text: '✕' })
        setConfig({
          privateBrowsingPermissionsRequired: true,
        })
        console.info('Private browsing permissions requested.')
      }
    }
  }

  async grantIncognitoAccess () {
    if (browser.isFirefox) {
      await browser.browserAction.setBadgeText({ text: '' })
      setConfig({
        privateBrowsingPermissionsRequired: false,
      })
    }
  }

  async setProxy () {
    const proxyConfig = {}
    const domains = await registry.getDomainsByLevel()

    if (Object.keys(domains).length === 0) {
      await this.removeProxy()
      return false
    }

    const {
      proxyServerURI,
      proxyServerProtocol,
    } = await this.getProxyingRules()

    const { localConfig: { countryCode } } = await getConfig('localConfig')

    console.log('COUNTRY:', countryCode)

    const pacData = getPacScript({
      domains,
      proxyServerURI,
      proxyServerProtocol,
      countryCode,
    })

    console.log('pacData:', pacData)

    if (browser.isFirefox) {
      const blob = new Blob([pacData], {
        type: 'application/x-ns-proxy-autoconfig',
      })

      proxyConfig.value = {
        proxyType: 'autoConfig',
        autoConfigUrl: URL.createObjectURL(blob),
      }
    } else {
      proxyConfig.scope = 'regular'
      proxyConfig.value = {
        mode: 'pac_script',
        pacScript: {
          data: pacData,
          mandatory: false,
        },
      }
    }

    try {
      await browser.proxy.settings.set(proxyConfig)
      await this.enableProxy()
      await this.grantIncognitoAccess()
      console.warn('PAC has been set successfully!')
      return true
    } catch (error) {
      console.error(`PAC could not be set: ${error}`)
      await this.disableProxy()
      await this.requestIncognitoAccess()
      return false
    }
  }

  async removeProxy () {
    await browser.proxy.settings.clear({})
    console.warn('Proxy settings removed.')
  }

  async alive () {
    const { proxyIsAlive } = await getConfig('proxyIsAlive')

    return proxyIsAlive
  }

  async ping () {
    const usingCustomProxy = await this.usingCustomProxy()

    if (!usingCustomProxy) {
      const { proxyPingURI } = await getConfig('proxyPingURI')

      fetch(`https://${proxyPingURI}`, {
        method: 'POST',
        headers: {
          'Content-type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          type: 'ping',
        }),
      }).catch(() => {
        // We don't care about the result.
        console.log(`Pinged ${proxyPingURI}!`)
      })
    }
  }

  async usingCustomProxy () {
    const { useOwnProxy } = await getConfig('useOwnProxy')

    return useOwnProxy
  }

  async isEnabled () {
    const { useProxy } = await getConfig('useProxy')

    return useProxy
  }

  async enableProxy () {
    console.log('Proxying enabled.')
    setConfig({ useProxy: true, proxyIsAlive: true })
  }

  async disableProxy () {
    console.warn('Proxying disabled.')
    setConfig({ useProxy: false })
  }

  async controlledByOtherExtensions () {
    const { levelOfControl } = await browser.proxy.settings.get({})

    return levelOfControl === 'controlled_by_other_extensions'
  }

  async controlledByThisExtension () {
    const { levelOfControl } = await browser.proxy.settings.get({})

    return levelOfControl === 'controlled_by_this_extension'
  }

  async takeControl () {
    const self = await browser.management.getSelf()
    const extensions = await browser.management.getAll()

    for (const { id, name, permissions } of extensions) {
      if (permissions.includes('proxy') && name !== self.name) {
        console.warn(`Disabling ${name}...`)
        await browser.management.setEnabled(id, false)
      }
    }
  }

  async removeCustomProxy () {
    setConfig({
      useOwnProxy: false,
    })
    await browser.storage.local.remove([
      'customProxyProtocol',
      'customProxyServerURI',
    ])
  }

  async removeBadProxies () {
    setConfig({ badProxies: [] })
  }

  async getBadProxies () {
    const { badProxies } = await getConfig('badProxies')

    return badProxies
  }
}

export default new ProxyManager()
