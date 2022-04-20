import * as storage from './storage'
import * as utilities from './utilities'

const Browser = utilities.getBrowser()

class Settings {
  getName () {
    return 'CensorTracker'
  }

  getDangerIcon () {
    return Browser.runtime.getURL('images/icons/128x128/danger.png')
  }

  getDefaultIcon () {
    return Browser.runtime.getURL('images/icons/128x128/default.png')
  }

  getDisabledIcon () {
    return Browser.runtime.getURL('images/icons/128x128/disabled.png')
  }

  getBlockedIcon () {
    return Browser.runtime.getURL('images/icons/128x128/blocked.png')
  }

  changePageIcon (tabId, path) {
    const title = this.getName()

    if (utilities.isFirefox()) {
      Browser.browserAction.setIcon({ tabId, path })
      Browser.browserAction.setTitle({ title, tabId })
    } else {
      Browser.action.setIcon({ tabId, path })
      Browser.action.setTitle({ title, tabId })
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
    const tabs = await Browser.tabs.query({})

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

    if (utilities.isFirefox()) {
      useProxy = await Browser.extension.isAllowedIncognitoAccess()
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

    if (utilities.isFirefox()) {
      await Browser.browserAction.setBadgeText({ text: '' })
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
}

export default new Settings()
