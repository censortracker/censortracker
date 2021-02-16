import { storage } from '.'

const manifest = browser.runtime.getManifest()
const rksUrl = 'https://reestr.rublacklist.net'

class Settings {
  getName = () => manifest.name;

  getVersion = () => manifest.version;

  getTitle = () => `${manifest.name} v${manifest.version}`;

  getDomainsApiUrl = () => `${rksUrl}/api/v3/domains/json`;

  getDistributorsApiUrl = () => `${rksUrl}/api/v3/ori/refused/json`;

  getLoggingApiUrl = () => 'https://ct-dev.rublacklist.net/api/case/';

  getLoggingApiHeaders = () => {
    return {
      'Censortracker-D': new Date().getTime(),
      'Censortracker-V': this.getVersion(),
      'Content-Type': 'application/json',
    }
  }

  getDangerIcon = () => browser.runtime.getURL('images/icons/128x128/danger.png');

  getDefaultIcon = () => browser.runtime.getURL('images/icons/128x128/default.png');

  getDisabledIcon = () => browser.runtime.getURL('images/icons/128x128/disabled.png');

  getBlockedIcon = () => browser.runtime.getURL('images/icons/128x128/blocked.png');

  changePageIcon = (tabId, path) => {
    browser.browserAction.setIcon({ tabId, path })
    browser.browserAction.setTitle({ title: this.getTitle(), tabId })
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
    const tabs = await browser.tabs.query({})

    for (const { id } of tabs) {
      if (enableExtension) {
        this.setDefaultIcon(id)
      } else {
        this.setDisableIcon(id)
      }
    }
  }

  extensionEnabled = async () => {
    const { enableExtension } = await storage.get({ enableExtension: true })

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
