const manifest = chrome.runtime.getManifest()
const rksUrl = 'https://reestr.rublacklist.net'

class Settings {
  getName = () => manifest.name;

  getVersion = () => manifest.version;

  getTitle = () => `${manifest.name} v${manifest.version}`;

  getDomainsApiUrl = () => `${rksUrl}/api/v3/domains/json`;

  getDistributorsApiUrl = () => `${rksUrl}/api/v3/ori/refused/json`;

  getLoggingApiUrl = () => 'https://ct-dev.rublacklist.net/api/case/';

  getDangerIcon = () => chrome.runtime.getURL('images/icons/128x128/danger.png');

  getDefaultIcon = () => chrome.runtime.getURL('images/icons/128x128/default.png');

  getDisabledIcon = () => chrome.runtime.getURL('images/icons/128x128/disabled.png');

  getPopupImage = ({ size = '512', name = 'default' }) => {
    return chrome.runtime.getURL(`images/icons/${size}x${size}/${name}.png`)
  }

  getProxyServerUrl = () => {
    return 'proxy-ssl.roskomsvoboda.org:33333'
  }

  _setPageIcon = (tabId, path) => {
    chrome.pageAction.setIcon({ tabId, path })
    chrome.pageAction.setTitle({ title: this.getTitle(), tabId })
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
