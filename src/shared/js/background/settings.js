import { getConfig, setConfig } from '../config'
import browser from './browser-api'

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
    const { enableExtension } = await getConfig('enableExtension')

    return enableExtension
  }

  async enableExtension () {
    setConfig({ enableExtension: true })
    console.log('Settings.enableExtension()')
  }

  async disableExtension () {
    setConfig({
      useProxy: false,
      enableExtension: false,
    })

    if (browser.isFirefox) {
      await browser.browserAction.setBadgeText({ text: '' })
    }

    console.log('Settings.disableExtension()')
  }

  async enableNotifications () {
    setConfig({ showNotifications: true })
  }

  async disableNotifications () {
    setConfig({ showNotifications: false })
  }

  async exportSettings () {
    const settings = Object.assign({}, await getConfig())

    settings.domains = []
    settings.disseminators = []

    return settings
  }

  async importSettings (settings) {
    await browser.storage.local.clear()
    setConfig(settings)
  }
}

export default new Settings()
