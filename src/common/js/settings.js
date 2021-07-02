import { Browser } from './browser'
import storage from './storage'

class Settings extends Browser {
  getName = () => this.manifest.name;

  getDangerIcon = () => this.browser.runtime.getURL('images/icons/128x128/danger.png');

  getDefaultIcon = () => this.browser.runtime.getURL('images/icons/128x128/default.png');

  getDisabledIcon = () => this.browser.runtime.getURL('images/icons/128x128/disabled.png');

  getBlockedIcon = () => this.browser.runtime.getURL('images/icons/128x128/blocked.png');

  changePageIcon = (tabId, path) => {
    const title = `${this.manifest.name} v${this.manifest.version}`

    if (this.isFirefox) {
      this.browser.browserAction.setIcon({ tabId, path })
      this.browser.browserAction.setTitle({ title, tabId })
    } else {
      this.browser.pageAction.setIcon({ tabId, path })
      this.browser.pageAction.setTitle({ title, tabId })
    }
  }

  setDisableIcon = (tabId) => {
    this.changePageIcon(tabId, this.getDisabledIcon())
  }

  setDefaultIcon = (tabId) => {
    this.changePageIcon(tabId, this.getDefaultIcon())
  }

  setDangerIcon = (tabId) => {
    this.changePageIcon(tabId, this.getDangerIcon())
  }

  setBlockedIcon = (tabId) => {
    this.changePageIcon(tabId, this.getBlockedIcon())
  }

  changeExtensionState = async ({ useProxy, enableExtension, showNotifications }) => {
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

  extensionEnabled = async () => {
    const { enableExtension } = await storage.get(['enableExtension'])

    return enableExtension
  }

  updateIncognitoAccessDeniedBadge = async () => {
    if (this.isFirefox) {
      const allowedIncognitoAccess =
        await this.browser.extension.isAllowedIncognitoAccess()
      const { privateBrowsingPermissionsRequired } =
        await storage.get({ privateBrowsingPermissionsRequired: false })

      if (!allowedIncognitoAccess || privateBrowsingPermissionsRequired) {
        await this.browser.browserAction.setBadgeText({ text: '✕' })
      } else {
        await this.browser.browserAction.setBadgeText({ text: '' })
      }
    }
  }

  enableExtension = async () => {
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

  disableExtension = async () => {
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

  enableNotifications = async () => {
    console.log('Notifications enabled.')
    await storage.set({ showNotifications: true })
  }

  disableNotifications = async () => {
    console.warn('Notifications disabled.')
    await storage.set({ showNotifications: false })
  }
}

export default new Settings()
