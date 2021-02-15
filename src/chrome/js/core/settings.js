const manifest = chrome.runtime.getManifest()
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

  getDangerIcon = () => chrome.runtime.getURL('images/icons/128x128/danger.png');

  getDefaultIcon = () => chrome.runtime.getURL('images/icons/128x128/default.png');

  getDisabledIcon = () => chrome.runtime.getURL('images/icons/128x128/disabled.png');

  getBlockedIcon = () => chrome.runtime.getURL('images/icons/128x128/blocked.png');

  changePageIcon = (tabId, path) => {
    chrome.pageAction.setIcon({ tabId, path })
    chrome.pageAction.setTitle({ title: this.getTitle(), tabId })
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

  _toggleExtension = ({ enableExtension }) => {
    if (typeof enableExtension === 'boolean') {
      chrome.storage.local.set({ enableExtension }, () => {
        console.warn('Extension enabled')
      })

      chrome.tabs.query({}, (tabs) => {
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
}

export default new Settings()
