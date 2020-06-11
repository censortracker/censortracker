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

  getIconByName = (iconName) => chrome.extension.getURL(`images/${iconName}.png`);

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
