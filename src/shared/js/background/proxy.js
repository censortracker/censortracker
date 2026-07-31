import { getPacScript } from 'Background/pac'

import browser from './browser-api'
import { ProxyMode } from './constants'
import ProxyClient from './localproxy'
import registry from './registry'
import Settings from './settings'

class ProxyManager {
  /**
   * Returns the currently selected proxy mode.
   * Installations made before «proxyMode» was introduced keep the mode
   * in a pair of booleans, so the value is derived once and stored.
   * @returns {Promise<string>} One of the ProxyMode values.
   */
  async getMode () {
    const {
      proxyMode,
      useOwnProxy,
      useLocalProxy,
    } = await browser.storage.local.get({
      proxyMode: '',
      useOwnProxy: false,
      useLocalProxy: false,
    })

    if (proxyMode) {
      return proxyMode
    }

    let mode = ProxyMode.DEFAULT

    if (useLocalProxy) {
      mode = ProxyMode.LOCAL
    } else if (useOwnProxy) {
      mode = ProxyMode.CUSTOM
    }

    await browser.storage.local.set({ proxyMode: mode })
    console.log(`Proxy mode migrated to: ${mode}`)
    return mode
  }

  /**
   * Switches the proxy mode. Modes are mutually exclusive, so everything
   * is written at once to make sure no one ever observes two active modes.
   * @param mode One of the ProxyMode values.
   */
  async setMode (mode) {
    await browser.storage.local.set({
      proxyMode: mode,
      useOwnProxy: mode === ProxyMode.CUSTOM,
      useLocalProxy: mode === ProxyMode.LOCAL,
    })

    if (mode !== ProxyMode.LOCAL) {
      await browser.storage.local.remove(['localProxyURI', 'localProxyAlive'])
      // Leaving the local proxy behind stops it on purpose, so a check
      // which is already in flight must not report that as a failure.
      await browser.storage.local.set({ localProxyStoppedByUs: true })
    } else {
      await browser.storage.local.remove(['localProxyStoppedByUs'])
    }

    console.warn(`Proxy mode changed to: ${mode}`)
  }

  async getProxyingRules () {
    const mode = await this.getMode()
    const {
      proxyServerURI,
      customProxyProtocol,
      customProxyServerURI,
      localProxyURI,
    } = await browser.storage.local.get([
      'proxyServerURI',
      'customProxyProtocol',
      'customProxyServerURI',
      'localProxyURI',
    ])

    // When local proxy server is used
    if (mode === ProxyMode.LOCAL && localProxyURI) {
      console.log(`Using local proxy server: ${localProxyURI}`)
      return {
        proxyServerProtocol: 'SOCKS5',
        proxyServerURI: localProxyURI,
      }
    }

    if (
      mode === ProxyMode.CUSTOM &&
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

  /**
   * Checks whether the Amnezia local proxy is up and keeps the stored
   * state in sync with it. Never enables proxying on its own and never
   * writes anything if the user switched the mode while we were waiting
   * for the local proxy client to respond.
   * @param startIfMissing Ask the client to start the proxy if it's down.
   * @returns {Promise<{alive: boolean}>} State of the local proxy.
   */
  async syncLocalProxy ({ startIfMissing = false } = {}) {
    if (!await this.usingLocalProxy()) {
      return { alive: false }
    }

    let proxyPort = await ProxyClient.ping(2500)

    if (!proxyPort && startIfMissing) {
      console.log('Trying to start AmneziaVPN in local proxy mode...')
      proxyPort = await ProxyClient.start(3000)
    }

    if (!await this.usingLocalProxy()) {
      console.warn('Proxy mode changed while checking the local proxy.')
      return { alive: false }
    }

    // Nothing is written unless it really changed: pages listen to these
    // keys to render themselves and to report a new connection.
    const { localProxyURI, localProxyAlive } =
      await browser.storage.local.get({
        localProxyURI: '',
        localProxyAlive: false,
      })

    // The local proxy is gone. Proxying has to stop, otherwise every
    // domain from the list keeps being routed to a port nobody listens
    // on and stays unreachable until the user repairs it by hand.
    if (!proxyPort) {
      if (localProxyAlive) {
        await browser.storage.local.set({ localProxyAlive: false })
        await this.removeProxy()
        await this.notifyLocalProxyIsDown()
      }
      return { alive: false }
    }

    const nextLocalProxyURI = `127.0.0.1:${proxyPort}`
    const portChanged = localProxyURI !== nextLocalProxyURI

    if (portChanged) {
      await browser.storage.local.set({ localProxyURI: nextLocalProxyURI })
    }

    if (!localProxyAlive) {
      await browser.storage.local.set({ localProxyAlive: true })
    }

    // The PAC is removed while the local proxy is down, so proxying has
    // to be restored once it's back, even on the very same port.
    if (portChanged || !localProxyAlive) {
      await this.setProxy()
    }
    return { alive: true }
  }

  /**
   * Tells the user that proxying is suspended, so that websites silently
   * going direct doesn't look like the extension is doing nothing.
   * @returns {Promise<void>}
   */
  async notifyLocalProxyIsDown () {
    const { showNotifications, localProxyStoppedByUs } =
      await browser.storage.local.get({
        showNotifications: true,
        localProxyStoppedByUs: false,
      })

    if (!showNotifications || localProxyStoppedByUs) {
      return
    }

    try {
      await browser.notifications.create('localProxyIsDown', {
        type: 'basic',
        title: Settings.getName(),
        iconUrl: Settings.getDangerIcon(),
        message: browser.i18n.getMessage('localProxyNotFoundDesc'),
      })
    } catch (error) {
      console.error(`Failed to notify about the local proxy: ${error}`)
    }
  }

  /**
   * Tells whether the local proxy is the mode the user asked for
   * and proxying is turned on.
   * @returns {Promise<boolean>}
   */
  async usingLocalProxy () {
    const mode = await this.getMode()

    if (mode !== ProxyMode.LOCAL) {
      return false
    }
    return this.isEnabled()
  }

  async requestIncognitoAccess () {
    if (browser.isFirefox) {
      const isAllowedIncognitoAccess =
        await browser.extension.isAllowedIncognitoAccess()

      if (!isAllowedIncognitoAccess) {
        await browser.browserAction.setBadgeText({ text: '✕' })
        await browser.storage.local.set({
          privateBrowsingPermissionsRequired: true,
        })
        console.info('Private browsing permissions requested.')
      }
    }
  }

  async grantIncognitoAccess () {
    if (browser.isFirefox) {
      await browser.browserAction.setBadgeText({ text: '' })
      await browser.storage.local.set({
        privateBrowsingPermissionsRequired: false,
      })
    }
  }

  async setProxy () {
    const config = {}

    // Applying the PAC must never turn proxying on behalf of the user:
    // «useProxy» is a user setting, callers enable it explicitly.
    if (!await this.isEnabled()) {
      console.warn('Proxying is disabled by user, skipping PAC setup...')
      return false
    }

    // The browser must never be pointed to a local proxy which is known
    // to be down, no matter which of the callers is asking for the PAC.
    if (await this.getMode() === ProxyMode.LOCAL) {
      const { localProxyAlive } =
        await browser.storage.local.get({ localProxyAlive: false })

      if (!localProxyAlive) {
        console.warn('Local proxy is down, proxying is suspended...')
        await this.removeProxy()
        return false
      }
    }

    const domains = await registry.getDomains()

    if (domains.length === 0) {
      console.error('No domains to proxy, aborting...')
      await this.removeProxy()
      return false
    }

    const {
      proxyServerURI,
      proxyServerProtocol,
    } = await this.getProxyingRules()

    // Without a proxy server the PAC would send every domain from the
    // list to a host named «undefined» and break them all.
    if (!proxyServerURI) {
      console.error('No proxy server to use, aborting...')
      await this.removeProxy()
      return false
    }

    const pacData = getPacScript({
      domains,
      proxyServerURI,
      proxyServerProtocol,
    })

    if (browser.isFirefox) {
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
      await browser.proxy.settings.set(config)

      // Setting a proxy resolves even when another extension owns the
      // setting, in which case nothing was applied at all.
      if (!await this.controlledByThisExtension()) {
        console.error('Proxy settings are controlled by another extension!')
        await browser.storage.local.set({ proxyControlledByOther: true })
        return false
      }

      await browser.storage.local.set({
        proxyIsAlive: true,
        proxyControlledByOther: false,
      })
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
    try {
      await browser.proxy.settings.clear({})
      console.warn('Proxy settings removed.')
      return true
    } catch (error) {
      console.error(`Proxy settings could not be removed: ${error}`)
      return false
    }
  }

  async alive () {
    const { proxyIsAlive } =
      await browser.storage.local.get({ proxyIsAlive: true })

    return proxyIsAlive
  }

  async ping () {
    const mode = await this.getMode()

    if (mode === ProxyMode.DEFAULT) {
      const { proxyPingURI } = await browser.storage.local.get('proxyPingURI')

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

  async isEnabled () {
    const { useProxy } = await browser.storage.local.get({ useProxy: true })

    return useProxy
  }

  async enableProxy () {
    console.log('Proxying enabled.')
    await browser.storage.local.set({ useProxy: true, proxyIsAlive: true })
  }

  async disableProxy () {
    console.warn('Proxying disabled.')
    await browser.storage.local.set({ useProxy: false })
    // Tearing the PAC down right here, in the same context which turned
    // proxying off: relying on the storage listener in the background
    // means the browser keeps proxying whenever it doesn't run.
    await this.removeProxy()
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

  async removeBadProxies () {
    await browser.storage.local.set({ badProxies: [] })
  }

  async getBadProxies () {
    const { badProxies } =
      await browser.storage.local.get({ badProxies: [] })

    return badProxies
  }
}

export default new ProxyManager()
