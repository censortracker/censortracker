import { getBrowser, isFirefox } from './browser'
import storage from './storage'

const currentBrowser = getBrowser()
const manifest = currentBrowser.runtime.getManifest()

class Settings {
  getName = () => manifest.name;

  getDangerIcon = () => currentBrowser.runtime.getURL('images/icons/128x128/danger.png');

  getDefaultIcon = () => currentBrowser.runtime.getURL('images/icons/128x128/default.png');

  getDisabledIcon = () => currentBrowser.runtime.getURL('images/icons/128x128/disabled.png');

  getBlockedIcon = () => currentBrowser.runtime.getURL('images/icons/128x128/blocked.png');

  changePageIcon = (tabId, path) => {
    const title = `${manifest.name} v${manifest.version}`

    if (isFirefox()) {
      currentBrowser.browserAction.setIcon({ tabId, path })
      currentBrowser.browserAction.setTitle({ title, tabId })
    } else {
      currentBrowser.pageAction.setIcon({ tabId, path })
      currentBrowser.pageAction.setTitle({ title, tabId })
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
    const tabs = await currentBrowser.tabs.query({})

    for (const { id } of tabs) {
      if (enableExtension) {
        this.setDefaultIcon(id)
      } else {
        this.setDisableIcon(id)
      }
    }
  }

  extensionEnabled = async () => {
    const { enableExtension } = await storage.get({ enableExtension: undefined })

    return enableExtension
  }

  enableExtension = async () => {
    await this.changeExtensionState({
      useProxy: true,
      enableExtension: true,
      showNotifications: true,
    })
    console.warn('Extension enabled')
  }

  disableExtension = async () => {
    await this.changeExtensionState({
      useProxy: false,
      enableExtension: false,
      showNotifications: false,
    })
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
