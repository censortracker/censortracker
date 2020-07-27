const manifest = chrome.runtime.getManifest()
const rksUrl = 'https://reestr.rublacklist.net'

class Settings {
  getName = () => manifest.name;

  getDescription = () => manifest.description;

  getVersion = () => manifest.version;

  getTitle = () => `${manifest.name} v${manifest.version}`;

  getDomainsApiUrl = () => `${rksUrl}/api/v3/domains/json`;

  getDistributorsApiUrl = () => `${rksUrl}/api/v3/ori/refused/json`;

  getLoggingApiUrl = () => 'https://ct-dev.rublacklist.net/api/domain/';

  getDangerIcon = () => chrome.extension.getURL('images/icons/128x128/danger.png');

  getDefaultIcon = () => chrome.extension.getURL('images/icons/128x128/default.png');

  getDisabledIcon = () => chrome.extension.getURL('images/icons/128x128/disabled.png');

  getPopupImage = ({ size = '512', name = 'default' }) => {
    return chrome.extension.getURL(`images/icons/${size}x${size}/${name}.png`)
  }

  getProxyServerUrl = () => {
    return 'proxy-ssl.roskomsvoboda.org:33333'
  }

  enableExtension = () => {
    chrome.storage.local.set(
      {
        enableExtension: true,
      },
      () => {
        console.warn('Extension enabled')
      },
    )
  }

  disableExtension = () => {
    chrome.storage.local.set(
      {
        enableExtension: false,
      },
      () => {
        console.warn('Extension disabled')
      },
    )
  }
}

export default new Settings()
