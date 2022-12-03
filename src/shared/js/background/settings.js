import Browser from './browser-api'

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
      await Browser.storage.local.get({ enableExtension: false })

    return enableExtension
  }

  async enableExtension () {
    await Browser.storage.local.set({ enableExtension: true })
    console.log('Settings.enableExtension()')
  }

  async disableExtension () {
    await Browser.storage.local.set({
      useProxy: false,
      enableExtension: false,
      showNotifications: false,
      parentalControl: false,
    })

    if (Browser.IS_FIREFOX) {
      await Browser.browserAction.setBadgeText({ text: '' })
    }

    console.log('Settings.disableExtension()')
  }

  async enableNotifications () {
    await Browser.storage.local.set({ showNotifications: true })
  }

  async disableNotifications () {
    await Browser.storage.local.set({ showNotifications: false })
  }

  async enableParentalControl () {
    await Browser.storage.local.set({ parentalControl: true })
  }

  async disableParentalControl () {
    await Browser.storage.local.set({ parentalControl: false })
  }
}

export default new Settings()
