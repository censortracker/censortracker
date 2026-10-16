import browser, { getDetailedBrowserInfo } from './browser-api'
import { settingsDefaults, validateSettings } from './settings-data'

class Settings {
  getName () {
    return 'Censor Tracker'
  }

  getDangerIcon () {
    return browser.runtime.getURL('images/icons/128x128/danger.png')
  }

  changePageIcon (tabId: number | undefined, filename: string) {
    const title = this.getName()
    const path = browser.runtime.getURL(`images/icons/128x128/${filename}.png`)

    const action = browser.isFirefox ? browser.browserAction : browser.action

    // A tab can close before its icon changes.
    Promise.all([
      action.setIcon({ tabId, path }), action.setTitle({ title, tabId }),
    ]).catch(() => console.warn('Could not update the page icon'))
  }

  setDisableIcon (tabId?: number) {
    this.changePageIcon(tabId, 'disabled')
  }

  setDefaultIcon (tabId?: number) {
    this.changePageIcon(tabId, 'default')
  }

  setDangerIcon (tabId?: number) {
    this.changePageIcon(tabId, 'danger')
  }

  setBlockedIcon (tabId?: number) {
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

  async exportSettings () {
    const { version, manifest_version: manifestVersion } =
      browser.runtime.getManifest()

    return {
      formatVersion: 1,
      exportedAt: new Date().toISOString(),
      extensionVersion: version,
      browser: await getDetailedBrowserInfo(),
      manifestVersion,
      settings: {
        ...settingsDefaults,
        ...validateSettings(await browser.storage.local.get(null)),
      },
    }
  }

  async importSettingsInBackground (settings: unknown) {
    const values = { ...settingsDefaults, ...validateSettings(settings) }

    await browser.storage.local.set({
      ...values,
      // Proxy subscription downloads still require a separate choice.
      proxySubscriptionsEnabled: false,
      useOwnProxy: values.selectedProxyIds.some((id) => id !== 'builtin'),
      localProxyURI: null,
      localProxyAlive: false,
    })
  }
}

export default new Settings()
