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

  _setPageIcon = (tabId, path) => {
    browser.browserAction.setIcon({ tabId, path })
    browser.browserAction.setTitle({ title: this.getTitle(), tabId })
  }

  setDisableIcon = (tabId) => {
    this._setPageIcon(tabId, this.getDisabledIcon())
  }

  setDefaultIcon = (tabId) => {
    this._setPageIcon(tabId, this.getDefaultIcon())
  }

  setDangerIcon = (tabId) => {
    this._setPageIcon(tabId, this.getDangerIcon())
  }

  _toggleExtension = ({ enableExtension }) => {
    if (typeof enableExtension === 'boolean') {
      browser.storage.local.set({ enableExtension }, () => {
        console.warn('Extension enabled')
      })

      browser.tabs.query({}, (tabs) => {
        tabs.forEach((tab) => {
          enableExtension ? this.setDefaultIcon(tab.id)
            : this.setDisableIcon(tab.id)
        })
      })
    }
  }

  enableExtension = () => {
    this._toggleExtension({ enableExtension: true })
  }

  disableExtension = () => {
    this._toggleExtension({ enableExtension: false })
  }

  enableNotifications = async () => {
    console.log('Notifications enabled.')
    await browser.storage.local.set({ showNotifications: true })
  }

  disableNotifications = async () => {
    console.warn('Notifications disabled.')
    await browser.storage.local.set({ showNotifications: false })
  }
}

export default new Settings()
