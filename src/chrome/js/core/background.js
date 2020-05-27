'use strict';

(function() {
  const REQUEST_FILTERS = {
    urls: ['*://*/*'],
    types: ['main_frame'],
  };
  const MAX_REDIRECTIONS_COUNT = 6;
  const ERR_CONNECTION_RESET = 'ERR_CONNECTION_RESET';
  const ERR_CONNECTION_CLOSED = 'ERR_CONNECTION_CLOSED';
  const ERR_CERT_COMMON_NAME_INVALID = 'ERR_CERT_COMMON_NAME_INVALID';
  const ERR_HTTP2_PROTOCOL_ERROR = 'ERR_HTTP2_PROTOCOL_ERROR';
  const ERR_TUNNEL_CONNECTION_FAILED = 'ERR_TUNNEL_CONNECTION_FAILED';
  const ERR_CERT_AUTHORITY_INVALID = 'ERR_CERT_AUTHORITY_INVALID';
  const RED_ICON = chrome.extension.getURL('images/red_icon.png');

  const onInstalled = (details) => {
    if (details.reason === 'install') {
      proxies.openPorts();
      shortcuts.enableExtension();
      registry.syncDatabase();
      proxies.setProxy();
    }
  };

  const onWindowsRemoved = (_windowId) => {
    chrome.storage.local.remove(['notifiedHosts']);
  };

  const onStartup = () => {
    registry.syncDatabase();
    updateState();
  };

  const onBeforeRequest = (details) => {
    if (shortcuts.validURL(details.url)) {
      return {
        redirectUrl: details.url.replace(/^http:/, 'https:'),
      };
    }
  };

  const onBeforeRedirect = (details) => {
    let requestId = details.requestId;
    let urlObject = new URL(details.url);
    let hostname = urlObject.hostname;

    let count = browserSession.getRequest(requestId, 'redirect_count', 0);
    if (count) {
      browserSession.putRequest(requestId, 'redirect_count', count + 1);
    } else {
      browserSession.putRequest(requestId, 'redirect_count', 1);
    }

    if (count >= MAX_REDIRECTIONS_COUNT) {
      if (chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {
        chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest);
      }

      chrome.storage.local.get(
        {
          ignoredSites: [],
        },
        (data) => {
          let ignoredSites = data.ignoredSites;

          if (!ignoredSites.includes(hostname)) {
            ignoredSites.push(hostname);
            console.warn(`Too many redirections. Site ${hostname} add to ignore`);
            chrome.storage.local.set({
              ignoredSites: ignoredSites,
            });
          }
        }
      );
    }
  };

  const onErrorOccurred = (details) => {
    // Removes "net::" from string
    let error = details.error.substr(5);

    let urlObject = new URL(details.url);
    let hostname = urlObject.hostname;
    let encodedURL = window.btoa(details.url);

    // Most likely in this case domain was blocked by DPI
    if (error === ERR_CONNECTION_RESET || error === ERR_CONNECTION_CLOSED) {
      proxies.setProxy(hostname);
      registry.reportBlockedByDPI(hostname);
      chrome.tabs.update({
        url: chrome.runtime.getURL(`pages/refused.html?${encodedURL}`),
      });
    }

    if (
      error === ERR_HTTP2_PROTOCOL_ERROR ||
      error === ERR_CERT_COMMON_NAME_INVALID ||
      error === ERR_TUNNEL_CONNECTION_FAILED ||
      error === ERR_CERT_AUTHORITY_INVALID
    ) {
      console.warn(`Certificate validation issue. Adding hostname to ignore...`);
      chrome.storage.local.get(
        {
          ignoredSites: [],
        },
        (data) => {
          let ignoredSites = data.ignoredSites;

          if (!ignoredSites.includes(hostname)) {
            ignoredSites.push(hostname);
            chrome.storage.local.set({
              ignoredSites: ignoredSites,
            });
          }

          if (chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {
            chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest);
          }

          chrome.tabs.update({
            url: details.url.replace('https:', 'http:'),
          });
        }
      );
    }
  };

  const onCompleted = (details) => {
    browserSession.deleteRequest(details.requestId);
    if (!chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {
      chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, REQUEST_FILTERS, ['blocking']);
    }
  };

  const notificationOnButtonClicked = (notificationId, buttonIndex) => {
    if (buttonIndex === 0) {
      chrome.tabs.query(
        {
          active: true,
          lastFocusedWindow: true,
        },
        (tabs) => {
          let activeTab = tabs[0];
          let urlObject = new URL(activeTab.url);
          let hostname = urlObject.hostname;

          chrome.storage.local.get(
            {
              mutedForever: [],
            },
            (result) => {
              let mutedForever = result.mutedForever;
              if (!mutedForever.find((item) => item === hostname)) {
                mutedForever.push(hostname);
                chrome.storage.local.set(
                  {
                    mutedForever: mutedForever,
                  },
                  () => {
                    console.warn(`Resource ${hostname} added to ignore. We won't notify you about it anymore`);
                  }
                );
              }
            }
          );
        }
      );
    }
  };

  const updateState = () => {
    chrome.storage.local.get(
      {
        enableExtension: true,
        ignoredSites: [],
      },
      (config) => {
        chrome.tabs.query(
          {
            active: true,
            lastFocusedWindow: true,
          },
          (tabs) => {
            let activeTab = tabs[0];
            let tabId = activeTab.id;
            if (!activeTab.url) return;
            let urlObject = new URL(activeTab.url);
            if (urlObject.protocol === 'chrome:') return;

            let currentHostname = shortcuts.cleanHostname(urlObject.hostname);
            let ignoredSites = config.ignoredSites;

            if (ignoredSites.includes(currentHostname)) {
              console.warn(`Site ${currentHostname} found in ignore`);
              chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest);
              return;
            }

            if (config.enableExtension) {
              if (!chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {
                chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, REQUEST_FILTERS, ['blocking']);
              }

              if (!chrome.webRequest.onErrorOccurred.hasListener(onErrorOccurred)) {
                chrome.webRequest.onErrorOccurred.addListener(onErrorOccurred, REQUEST_FILTERS);
              }

              registry.checkDistributors(currentHostname, {
                onMatchFound: (cooperationRefused) => {
                  setMatchFoundIcon(tabId);
                  if (!cooperationRefused) {
                    setCooperationAcceptedBadge(tabId);
                    showCooperationAcceptedWarning(currentHostname);
                  }
                },
              });

              registry.checkDomains(currentHostname, {
                onMatchFound: (_data) => {
                  setMatchFoundIcon(tabId);
                },
                onMatchNotFound: () => {
                  registry.checkDistributors(currentHostname, {
                    onMatchFound: (cooperationRefused) => {
                      if (!cooperationRefused) {
                        setCooperationAcceptedBadge(tabId);
                      }
                    },
                  });
                },
              });
            } else {
              if (chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {
                chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest);
              }

              if (chrome.webRequest.onErrorOccurred.hasListener(onErrorOccurred)) {
                chrome.webRequest.onErrorOccurred.removeListener(onErrorOccurred);
              }
            }
          }
        );
      }
    );
  };

  const setMatchFoundIcon = (tabId) => {
    chrome.browserAction.setIcon({
      tabId: tabId,
      path: RED_ICON,
    });
  };

  const showCooperationAcceptedWarning = (hostname) => {
    chrome.storage.local.get(
      {
        notifiedHosts: [],
        mutedForever: [],
      },
      (result) => {
        if (!result || !hostname) return;

        let mutedForever = result.mutedForever;
        let notifiedHosts = result.notifiedHosts;

        if (mutedForever.find((item) => item === hostname)) return;
        if (!notifiedHosts.find((item) => item === hostname)) {
          chrome.notifications.create({
            type: 'basic',
            title: 'Censor Tracker: ' + hostname,
            priority: 2,
            message: 'Этот ресурс может передавать информацию третьим лицам.',
            buttons: [
              {
                title: '\u2715 Не показывать для этого сайта',
              },
              {
                title: '\u2192 Подробнее',
              },
            ],
            iconUrl: RED_ICON,
          });
        }

        if (!notifiedHosts.includes(hostname)) {
          notifiedHosts.push(hostname);
          chrome.storage.local.set(
            {
              notifiedHosts: notifiedHosts,
            },
            () => {
              console.warn('The list of the notified ORI resource updated!');
            }
          );
        }
      }
    );
  };

  const setCooperationAcceptedBadge = (tabId) => {
    chrome.browserAction.setBadgeBackgroundColor({
      color: '#F93E2D',
      tabId: tabId,
    });
    chrome.browserAction.setBadgeText({
      text: '\u2691',
      tabId: tabId,
    });
    chrome.browserAction.setTitle({
      title: settings.getTitle(),
      tabId: tabId,
    });
  };

  chrome.runtime.onInstalled.addListener(onInstalled);
  chrome.windows.onRemoved.addListener(onWindowsRemoved);
  chrome.runtime.onStartup.addListener(onStartup);
  chrome.webRequest.onErrorOccurred.addListener(onErrorOccurred, REQUEST_FILTERS);
  chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, REQUEST_FILTERS, ['blocking']);
  chrome.webRequest.onBeforeRedirect.addListener(onBeforeRedirect, {
    urls: ['*://*/*'],
  });
  chrome.webRequest.onCompleted.addListener(onCompleted, {
    urls: ['*://*/*'],
  });
  chrome.notifications.onButtonClicked.addListener(notificationOnButtonClicked);
  chrome.tabs.onActivated.addListener(updateState);
  chrome.tabs.onUpdated.addListener(updateState);

  setInterval(() => {
    proxies.openPorts();
  }, 60 * 1000 * 3);
})();
