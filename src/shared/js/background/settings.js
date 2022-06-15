import * as storage from './storage'
import Browser from './webextension'

class Settings {
  getName () {
    return 'Censor Tracker'
  }

  getDangerIcon () {
    return Browser.runtime.getURL('images/icons/128x128/danger.png')
  }

  changePageIcon (tabId, filename) {
    const title = this.getName()
    const path = Browser.runtime.getURL(`images/icons/128x128/${filename}.png`)

    if (Browser.IS_FIREFOX) {
      Browser.browserAction.setIcon({ tabId, path })
      Browser.browserAction.setTitle({ title, tabId })
    } else {
      Browser.action.setIcon({ tabId, path })
      Browser.action.setTitle({ title, tabId })
    }
  }

  async showInstalledPage (tabId) {
    await Browser.tabs.create({ url: 'installed.html' })
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

  async extensionEnabled () {
    const { enableExtension } = await storage.get({ enableExtension: false })

    return enableExtension
  }

  async enableExtension () {
    await storage.set({ enableExtension: true })
    console.log('Settings.enableExtension()')
  }

  async disableExtension () {
    await storage.set({
      useProxy: false,
      enableExtension: false,
      showNotifications: false,
    })

    if (Browser.IS_FIREFOX) {
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

  async enableParentalControl () {
    await storage.set({ parentalControl: true })
  }

  async disableParentalControl () {
    await storage.set({ parentalControl: false })
  }
}

export default new Settings()
