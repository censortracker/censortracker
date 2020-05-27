(() => {
  $('body').tooltip({
    selector: '[data-toggle="tooltip"]',
  });

  let statusImage = document.getElementById('statusImage');
  let popupFooter = document.getElementById('popupFooter');
  let lastSyncDate = document.getElementById('lastSyncDate');
  let oriMatchFound = document.getElementById('oriMatchFound');
  let registryMatchFound = document.getElementById('matchFound');
  let vpnAdvertising = document.getElementById('vpnAdvertising');
  let extensionStatus = document.getElementById('extensionStatus');
  let extensionStatusLabel = document.getElementById('extensionStatusLabel');
  let cooperationAccepted = document.getElementById('cooperationAccepted');
  let cooperationRejected = document.getElementById('cooperationRejected');
  let currentDomain = document.getElementById('currentDomain');
  let extensionName = document.getElementById('extensionName');
  let redIcon = chrome.extension.getURL('images/red_icon.png');

  const updateExtensionStatusLabel = () => {
    let labelText = 'Расширение выключено';
    let tooltipTitle = 'Censor Tracker выключен';

    if (extensionStatus.checked) {
      labelText = 'Расширение включено';
      tooltipTitle = 'Censor Tracker включен';
    }
    extensionStatusLabel.innerText = labelText;
    extensionStatusLabel.setAttribute('title', tooltipTitle);
  };

  chrome.runtime.getBackgroundPage((bgWindow) => {
    extensionName.innerText = bgWindow.settings.getTitle();

    document.addEventListener('click', (event) => {
      if (event.target.matches(`#${extensionStatus.id}`)) {
        updateExtensionStatusLabel();
        if (extensionStatus.checked) {
          popupFooter.hidden = false;
          bgWindow.shortcuts.enableExtension();
          bgWindow.proxies.setProxy();
        } else {
          popupFooter.hidden = true;
          bgWindow.proxies.removeProxy();
          bgWindow.shortcuts.disableExtension();
        }
      }
    });

    chrome.storage.local.get(
      {
        enableExtension: true,
      },
      (config) => {
        if (config.enableExtension) {
          extensionStatus.checked = config.enableExtension;
        }
      }
    );

    chrome.tabs.query(
      {
        active: true,
        lastFocusedWindow: true,
      },
      (tabs) => {
        let activeTab = tabs[0];
        let activeTabUrl = activeTab.url;

        if (activeTabUrl.startsWith('chrome-extension://')) {
          popupFooter.hidden = true;
          return;
        }

        let urlObject = new URL(activeTabUrl);
        let currentHostname = bgWindow.shortcuts.cleanHostname(urlObject.hostname);

        chrome.storage.local.get(
          {
            enableExtension: true,
          },
          (config) => {
            if (bgWindow.shortcuts.validURL(currentHostname)) {
              currentDomain.innerText = currentHostname.replace('www.', '');
            }

            updateExtensionStatusLabel();

            if (config.enableExtension) {
              bgWindow.registry.getLastSyncTimestamp((timestamp) => {
                lastSyncDate.innerText = timestamp.replace(/\//g, '.');
              });

              bgWindow.registry.checkDomains(currentHostname, {
                onMatchFound: (_data) => {
                  registryMatchFound.innerHTML = bgWindow.shortcuts.createSearchLink(currentHostname);
                  vpnAdvertising.hidden = false;
                  statusImage.setAttribute('src', redIcon);
                },
              });

              bgWindow.registry.checkDistributors(currentHostname, {
                onMatchFound: (cooperationRefused) => {
                  oriMatchFound.innerHTML = bgWindow.shortcuts.createSearchLink(currentHostname);
                  vpnAdvertising.hidden = false;
                  statusImage.setAttribute('src', redIcon);

                  if (cooperationRefused) {
                    cooperationRejected.hidden = false;
                  } else {
                    cooperationAccepted.hidden = false;
                  }
                },
              });
            } else {
              popupFooter.hidden = true;
            }
          }
        );
      }
    );

    const show = () => {
      document.documentElement.style.visibility = 'initial';
    };

    setTimeout(show, 160);
  });
})();
