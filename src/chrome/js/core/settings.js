const manifest = chrome.runtime.getManifest()

class Settings {
  getName = () => manifest.name;

  getVersion = () => manifest.version;

  getTitle = () => `${manifest.name} v${manifest.version}`;

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

  debugging = async () => {
    chrome.storage.local.set({
      ignoredHosts: [
        'api.google.com',
        'drive.google.com',
        'support.google.com',
      ],
    })
  }
}

export default new Settings()
