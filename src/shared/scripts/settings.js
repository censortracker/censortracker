import * as storage from './storage'
import Browser from './webextension'

class Settings {
  getName () {
    return 'CensorTracker'
  }

  getDangerIcon () {
    return Browser.runtime.getURL('images/icons/128x128/danger.png')
  }

  changePageIcon (tabId, filename) {
    const title = this.getName()
    const path = Browser.runtime.getURL(`images/icons/128x128/${filename}.png`)

    if (Browser.isFirefox) {
      Browser.browserAction.setIcon({ tabId, path })
      Browser.browserAction.setTitle({ title, tabId })
    } else {
      Browser.action.setIcon({ tabId, path })
      Browser.action.setTitle({ title, tabId })
    }
  }

  setDisableIcon (tabId) {
    this.changePageIcon(tabId, 'disabled')
    console.warn('Settings.setDisableIcon()')
  }

  setDefaultIcon (tabId) {
    this.changePageIcon(tabId, 'default')
    console.warn('Settings.setDefaultIcon()')
  }

  setDangerIcon (tabId) {
    this.changePageIcon(tabId, 'danger')
    console.warn('Settings.setDangerIcon()')
  }

  setBlockedIcon (tabId) {
    this.changePageIcon(tabId, 'blocked')
    console.warn('Settings.setBlockedIcon()')
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

    if (Browser.isFirefox) {
      useProxy = await Browser.extension.isAllowedIncognitoAccess()
    }

    await this.changeExtensionState({
      useProxy,
      enableExtension: true,
      showNotifications: true,
    })
    console.log('Settings.enableExtension()')
  }

  async disableExtension () {
    await this.changeExtensionState({
      useProxy: false,
      enableExtension: false,
      showNotifications: false,
    })

    if (Browser.isFirefox) {
      await Browser.browserAction.setBadgeText({ text: '' })
    }

    console.warn('Settings.disableExtension()')
  }

  async enableNotifications () {
    await storage.set({ showNotifications: true })
    console.log('Settings.enableNotifications()')
  }

  async disableNotifications () {
    await storage.set({ showNotifications: false })
    console.warn('Settings.disableNotifications()')
  }
}

export default new Settings()
