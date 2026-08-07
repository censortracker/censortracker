import browser from './browser-api'

/**
 * Keys `importSettings()` is allowed to restore.
 *
 * A settings file is untrusted input — it can be edited or shared by anyone —
 * and `storage.local` also holds fetched state the extension trusts implicitly
 * (`localConfig`, `proxyServerURI`, `domains`, `proxyStatuses`, ...). Writing a
 * file's contents in wholesale would let it pin a chosen proxy server or forge
 * the blocklist, so only genuine user-owned settings are restored and
 * everything else is re-derived on the next sync.
 *
 * Keep this in sync when adding a user-facing setting: a key missing here is
 * silently dropped on import.
 * @type {string[]}
 */
const IMPORTABLE_SETTINGS = [
  // General
  'enableExtension',
  'showNotifications',
  'currentRegionCode',
  // Registry
  'useRegistry',
  'useCustomRegistry',
  'customRegistryUrl',
  // User-curated domain lists
  'customProxiedDomains',
  'ignoredHosts',
  // Proxying
  'useProxy',
  'proxyAllTraffic',
  'useOwnProxy',
  'useLocalProxy',
  'activeProxyConfigName',
  'proxyTestTarget',
  'autoDeleteDeadProxies',
  // The user's proxy list and the chain that orders it. Dropping these would
  // make "export settings" useless as a backup of the thing users care about
  // most, so they are restored together with the legacy first-hop mirror.
  'customProxies',
  'proxyChain',
  'activeCustomProxyId',
  'customProxyProtocol',
  'customProxyServerURI',
  // Proxy subscriptions
  'proxySources',
  'proxySourcesEnabled',
  'proxySourcesIntervalMinutes',
  'proxySourcesUseProxy',
  'proxySourcesAutoTest',
  // Country pre-filter
  'proxyCountryFilterMode',
  'proxyCountryFilterList',
  'proxyCountryFilterAuto',
  'proxyCountryFilterRemoveUnknown',
]

class Settings {
  getName () {
    return 'Censor Tracker'
  }

  getDangerIcon () {
    return browser.runtime.getURL('images/icons/128x128/danger.png')
  }

  changePageIcon (tabId, filename) {
    const title = this.getName()
    const path = browser.runtime.getURL(`images/icons/128x128/${filename}.png`)

    if (browser.isFirefox) {
      browser.browserAction.setIcon({ tabId, path })
      browser.browserAction.setTitle({ title, tabId })
    } else {
      browser.action.setIcon({ tabId, path })
      browser.action.setTitle({ title, tabId })
    }
  }

  async showInstalledPage (tabId) {
    await browser.tabs.create({ url: 'installed.html' })
  }

  setDisableIcon (tabId) {
    this.changePageIcon(tabId, 'disabled')
  }

  setDefaultIcon (tabId) {
    this.changePageIcon(tabId, 'default')
  }

  setDangerIcon (tabId) {
    this.changePageIcon(tabId, 'danger')
  }

  setBlockedIcon (tabId) {
    this.changePageIcon(tabId, 'blocked')
  }

  async extensionEnabled () {
    const { enableExtension } =
      await browser.storage.local.get({ enableExtension: false })

    return enableExtension
  }

  async enableExtension () {
    await browser.storage.local.set({ enableExtension: true })
    console.log('Settings.enableExtension()')
  }

  async disableExtension () {
    await browser.storage.local.set({
      useProxy: false,
      enableExtension: false,
      showNotifications: false,
    })

    if (browser.isFirefox) {
      await browser.browserAction.setBadgeText({ text: '' })
    }

    console.log('Settings.disableExtension()')
  }

  async enableNotifications () {
    await browser.storage.local.set({ showNotifications: true })
  }

  async disableNotifications () {
    await browser.storage.local.set({ showNotifications: false })
  }

  async exportSettings () {
    const settings = await browser.storage.local.get(null)

    settings.domains = []
    settings.disseminators = []
    return settings
  }

  async importSettings (settings) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      throw new Error('Invalid settings file: expected a JSON object.')
    }

    const restored = {}

    for (const key of IMPORTABLE_SETTINGS) {
      if (Object.prototype.hasOwnProperty.call(settings, key)) {
        restored[key] = settings[key]
      }
    }

    await browser.storage.local.clear()
    await browser.storage.local.set(restored)
  }
}

export default new Settings()
