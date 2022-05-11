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
    console.log('Settings.setDisableIcon()')
  }

  setDefaultIcon (tabId) {
    this.changePageIcon(tabId, 'default')
    console.log('Settings.setDefaultIcon()')
  }

  setDangerIcon (tabId) {
    this.changePageIcon(tabId, 'danger')
    console.log('Settings.setDangerIcon()')
  }

  setBlockedIcon (tabId) {
    this.changePageIcon(tabId, 'blocked')
    console.log('Settings.setBlockedIcon()')
  }

  async changeExtensionState ({ useProxy, enableExtension, showNotifications }) {
    const tabs = await Browser.tabs.query({})

    await storage.set({
      useProxy,
      enableExtension,
      showNotifications,
    })

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

    console.log('Settings.disableExtension()')
  }

  async enableNotifications () {
    await storage.set({ showNotifications: true })
    console.log('Settings.enableNotifications()')
  }

  async disableNotifications () {
    await storage.set({ showNotifications: false })
    console.log('Settings.disableNotifications()')
  }
}

export default new Settings()
