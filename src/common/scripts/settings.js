import * as storage from './storage'
import * as utilities from './utilities'

class Settings {
  constructor () {
    this.browser = utilities.getBrowser()
    this.isFirefox = utilities.isFirefox()
  }

  getName () {
    return 'CensorTracker'
  }

  getDangerIcon () {
    return this.browser.runtime.getURL('images/icons/128x128/danger.png')
  }

  getDefaultIcon () {
    return this.browser.runtime.getURL('images/icons/128x128/default.png')
  }

  getDisabledIcon () {
    return this.browser.runtime.getURL('images/icons/128x128/disabled.png')
  }

  getBlockedIcon () {
    return this.browser.runtime.getURL('images/icons/128x128/blocked.png')
  }

  changePageIcon (tabId, path) {
    const title = this.getName()

    if (this.isFirefox) {
      this.browser.browserAction.setIcon({ tabId, path })
      this.browser.browserAction.setTitle({ title, tabId })
    } else {
      this.browser.action.setIcon({ tabId, path })
      this.browser.action.setTitle({ title, tabId })
    }
  }

  setDisableIcon (tabId) {
    this.changePageIcon(tabId, this.getDisabledIcon())
  }

  setDefaultIcon (tabId) {
    this.changePageIcon(tabId, this.getDefaultIcon())
  }

  setDangerIcon (tabId) {
    this.changePageIcon(tabId, this.getDangerIcon())
  }

  setBlockedIcon (tabId) {
    this.changePageIcon(tabId, this.getBlockedIcon())
  }

  async changeExtensionState ({ useProxy, enableExtension, showNotifications }) {
    await storage.set({ useProxy, enableExtension, showNotifications })
    const tabs = await this.browser.tabs.query({})

    for (const { id } of tabs) {
      if (enableExtension) {
        this.setDefaultIcon(id)
      } else {
        this.setDisableIcon(id)
      }
    }
  }

  async extensionEnabled () {
    const { enableExtension } = await storage.get(['enableExtension'])

    return enableExtension
  }

  async enableExtension () {
    let useProxy = true

    if (this.isFirefox) {
      useProxy = await this.browser.extension.isAllowedIncognitoAccess()
    }

    await this.changeExtensionState({
      useProxy,
      enableExtension: true,
      showNotifications: true,
    })
    console.log('Extension enabled')
  }

  async disableExtension () {
    await this.changeExtensionState({
      useProxy: false,
      enableExtension: false,
      showNotifications: false,
    })

    if (this.isFirefox) {
      await this.browser.browserAction.setBadgeText({ text: '' })
    }

    console.warn('Extension disabled')
  }

  async enableNotifications () {
    console.log('Notifications enabled.')
    await storage.set({ showNotifications: true })
  }

  async disableNotifications () {
    console.warn('Notifications disabled.')
    await storage.set({ showNotifications: false })
  }

  async disableDPIDetection () {
    await storage.set({ useDPIDetection: false })
  }

  async enableDPIDetection () {
    await storage.set({ useDPIDetection: true })
  }
}

export default new Settings()
