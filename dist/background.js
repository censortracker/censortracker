module.exports =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};
/******/
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/
/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId]) {
/******/ 			return installedModules[moduleId].exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			i: moduleId,
/******/ 			l: false,
/******/ 			exports: {}
/******/ 		};
/******/
/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/
/******/ 		// Flag the module as loaded
/******/ 		module.l = true;
/******/
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/
/******/
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;
/******/
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;
/******/
/******/ 	// define getter function for harmony exports
/******/ 	__webpack_require__.d = function(exports, name, getter) {
/******/ 		if(!__webpack_require__.o(exports, name)) {
/******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
/******/ 		}
/******/ 	};
/******/
/******/ 	// define __esModule on exports
/******/ 	__webpack_require__.r = function(exports) {
/******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 		}
/******/ 		Object.defineProperty(exports, '__esModule', { value: true });
/******/ 	};
/******/
/******/ 	// create a fake namespace object
/******/ 	// mode & 1: value is a module id, require it
/******/ 	// mode & 2: merge all properties of value into the ns
/******/ 	// mode & 4: return value when already ns object
/******/ 	// mode & 8|1: behave like require
/******/ 	__webpack_require__.t = function(value, mode) {
/******/ 		if(mode & 1) value = __webpack_require__(value);
/******/ 		if(mode & 8) return value;
/******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
/******/ 		var ns = Object.create(null);
/******/ 		__webpack_require__.r(ns);
/******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
/******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
/******/ 		return ns;
/******/ 	};
/******/
/******/ 	// getDefaultExport function for compatibility with non-harmony modules
/******/ 	__webpack_require__.n = function(module) {
/******/ 		var getter = module && module.__esModule ?
/******/ 			function getDefault() { return module['default']; } :
/******/ 			function getModuleExports() { return module; };
/******/ 		__webpack_require__.d(getter, 'a', getter);
/******/ 		return getter;
/******/ 	};
/******/
/******/ 	// Object.prototype.hasOwnProperty.call
/******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
/******/
/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "/";
/******/
/******/
/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(__webpack_require__.s = "./src/chrome/js/background.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./src/chrome/js/background.js":
/*!*************************************!*\
  !*** ./src/chrome/js/background.js ***!
  \*************************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("const REQUEST_FILTERS = {\n  urls: ['*://*/*'],\n  types: ['main_frame']\n};\nconst MAX_REDIRECTIONS_COUNT = 6;\nconst ERR_CONNECTION_RESET = 'ERR_CONNECTION_RESET';\nconst ERR_CONNECTION_CLOSED = 'ERR_CONNECTION_CLOSED';\nconst ERR_CERT_COMMON_NAME_INVALID = 'ERR_CERT_COMMON_NAME_INVALID';\nconst ERR_HTTP2_PROTOCOL_ERROR = 'ERR_HTTP2_PROTOCOL_ERROR';\nconst ERR_TUNNEL_CONNECTION_FAILED = 'ERR_TUNNEL_CONNECTION_FAILED';\nconst ERR_CERT_AUTHORITY_INVALID = 'ERR_CERT_AUTHORITY_INVALID';\nconst ERR_CONNECTION_TIMED_OUT = 'ERR_CONNECTION_TIMED_OUT';\nconst RED_ICON = chrome.extension.getURL('images/red_icon.png');\n\nconst onInstalled = details => {\n  if (details.reason === 'install') {\n    window.censortracker.proxies.openPorts();\n    window.censortracker.shortcuts.enableExtension();\n    window.censortracker.registry.syncDatabase();\n    window.censortracker.proxies.setProxy();\n  }\n};\n\nconst onWindowsRemoved = _windowId => {\n  chrome.storage.local.remove(['notifiedHosts']);\n};\n\nconst onStartup = () => {\n  window.censortracker.registry.syncDatabase();\n  updateState();\n};\n\nconst onBeforeRequest = details => {\n  if (window.censortracker.shortcuts.validURL(details.url)) {\n    return {\n      redirectUrl: details.url.replace(/^http:/, 'https:')\n    };\n  }\n\n  return null;\n};\n\nconst onBeforeRedirect = details => {\n  const requestId = details.requestId;\n  const urlObject = new URL(details.url);\n  const hostname = urlObject.hostname;\n  const count = window.censortracker.browserSession.getRequest(requestId, 'redirect_count', 0);\n\n  if (count) {\n    window.censortracker.browserSession.putRequest(requestId, 'redirect_count', count + 1);\n  } else {\n    window.censortracker.browserSession.putRequest(requestId, 'redirect_count', 1);\n  }\n\n  if (count >= MAX_REDIRECTIONS_COUNT) {\n    if (chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {\n      chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest);\n    }\n\n    chrome.storage.local.get({\n      ignoredSites: []\n    }, data => {\n      const ignoredSites = data.ignoredSites;\n\n      if (!ignoredSites.includes(hostname)) {\n        ignoredSites.push(hostname);\n        console.warn(`Too many redirections. Site ${hostname} add to ignore`);\n        chrome.storage.local.set({\n          ignoredSites\n        });\n      }\n    });\n  }\n};\n\nconst onErrorOccurred = details => {\n  // Removes \"net::\" from string\n  const error = details.error.substr(5);\n  const urlObject = new URL(details.url);\n  const hostname = urlObject.hostname;\n  const encodedURL = window.btoa(details.url); // Most likely in this case domain was blocked by DPI\n\n  if (error === ERR_CONNECTION_RESET || error === ERR_CONNECTION_CLOSED || error === ERR_CONNECTION_TIMED_OUT) {\n    window.censortracker.proxies.setProxy(hostname);\n    window.censortracker.registry.reportBlockedByDPI(hostname);\n    chrome.tabs.update({\n      url: chrome.runtime.getURL(`pages/refused.html?${encodedURL}`)\n    });\n  }\n\n  if (error === ERR_HTTP2_PROTOCOL_ERROR || error === ERR_CERT_COMMON_NAME_INVALID || error === ERR_TUNNEL_CONNECTION_FAILED || error === ERR_CERT_AUTHORITY_INVALID) {\n    console.warn('Certificate validation issue. Adding hostname to ignore...');\n    chrome.storage.local.get({\n      ignoredSites: []\n    }, data => {\n      const ignoredSites = data.ignoredSites;\n\n      if (!ignoredSites.includes(hostname)) {\n        ignoredSites.push(hostname);\n        chrome.storage.local.set({\n          ignoredSites\n        });\n      }\n\n      if (chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {\n        chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest);\n      }\n\n      chrome.tabs.update({\n        url: details.url.replace('https:', 'http:')\n      });\n    });\n  }\n};\n\nconst onCompleted = details => {\n  window.censortracker.browserSession.deleteRequest(details.requestId);\n\n  if (!chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {\n    chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, REQUEST_FILTERS, ['blocking']);\n  }\n};\n\nconst notificationOnButtonClicked = (notificationId, buttonIndex) => {\n  if (buttonIndex === 0) {\n    chrome.tabs.query({\n      active: true,\n      lastFocusedWindow: true\n    }, tabs => {\n      const activeTab = tabs[0];\n      const urlObject = new URL(activeTab.url);\n      const hostname = urlObject.hostname;\n      chrome.storage.local.get({\n        mutedForever: []\n      }, result => {\n        const mutedForever = result.mutedForever;\n\n        if (!mutedForever.find(item => item === hostname)) {\n          mutedForever.push(hostname);\n          chrome.storage.local.set({\n            mutedForever\n          }, () => {\n            console.warn(`Resource ${hostname} added to ignore. We won't notify you about it anymore`);\n          });\n        }\n      });\n    });\n  }\n};\n\nconst updateState = () => {\n  chrome.storage.local.get({\n    enableExtension: true,\n    ignoredSites: []\n  }, config => {\n    chrome.tabs.query({\n      active: true,\n      lastFocusedWindow: true\n    }, tabs => {\n      const activeTab = tabs[0];\n      const tabId = activeTab.id;\n\n      if (!activeTab.url) {\n        return;\n      }\n\n      const urlObject = new URL(activeTab.url);\n\n      if (urlObject.protocol === 'chrome:') {\n        return;\n      }\n\n      const currentHostname = window.censortracker.shortcuts.cleanHostname(urlObject.hostname);\n      const ignoredSites = config.ignoredSites;\n\n      if (ignoredSites.includes(currentHostname)) {\n        console.warn(`Site ${currentHostname} found in ignore`);\n        chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest);\n        return;\n      }\n\n      if (config.enableExtension) {\n        if (!chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {\n          chrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, REQUEST_FILTERS, ['blocking']);\n        }\n\n        if (!chrome.webRequest.onErrorOccurred.hasListener(onErrorOccurred)) {\n          chrome.webRequest.onErrorOccurred.addListener(onErrorOccurred, REQUEST_FILTERS);\n        }\n\n        window.censortracker.registry.checkDistributors(currentHostname, {\n          onMatchFound: cooperationRefused => {\n            setMatchFoundIcon(tabId);\n\n            if (!cooperationRefused) {\n              setCooperationAcceptedBadge(tabId);\n              showCooperationAcceptedWarning(currentHostname);\n            }\n          }\n        });\n        window.censortracker.registry.checkDomains(currentHostname, {\n          onMatchFound: _data => {\n            setMatchFoundIcon(tabId);\n          },\n          onMatchNotFound: () => {\n            window.censortracker.registry.checkDistributors(currentHostname, {\n              onMatchFound: cooperationRefused => {\n                if (!cooperationRefused) {\n                  setCooperationAcceptedBadge(tabId);\n                }\n              }\n            });\n          }\n        });\n      } else {\n        if (chrome.webRequest.onBeforeRequest.hasListener(onBeforeRequest)) {\n          chrome.webRequest.onBeforeRequest.removeListener(onBeforeRequest);\n        }\n\n        if (chrome.webRequest.onErrorOccurred.hasListener(onErrorOccurred)) {\n          chrome.webRequest.onErrorOccurred.removeListener(onErrorOccurred);\n        }\n      }\n    });\n  });\n};\n\nconst setMatchFoundIcon = tabId => {\n  chrome.browserAction.setIcon({\n    tabId,\n    path: RED_ICON\n  });\n};\n\nconst showCooperationAcceptedWarning = hostname => {\n  chrome.storage.local.get({\n    notifiedHosts: [],\n    mutedForever: []\n  }, result => {\n    if (!result || !hostname) {\n      return;\n    }\n\n    const mutedForever = result.mutedForever;\n\n    if (mutedForever.find(item => item === hostname)) {\n      return;\n    }\n\n    const notifiedHosts = result.notifiedHosts;\n\n    if (!notifiedHosts.find(item => item === hostname)) {\n      chrome.notifications.create({\n        type: 'basic',\n        title: `Censor Tracker: ${hostname}`,\n        priority: 2,\n        message: 'Этот ресурс может передавать информацию третьим лицам.',\n        buttons: [{\n          title: '\\u2715 Не показывать для этого сайта'\n        }, {\n          title: '\\u2192 Подробнее'\n        }],\n        iconUrl: RED_ICON\n      });\n    }\n\n    if (!notifiedHosts.includes(hostname)) {\n      notifiedHosts.push(hostname);\n      chrome.storage.local.set({\n        notifiedHosts\n      }, () => {\n        console.warn('The list of the notified ORI resource updated!');\n      });\n    }\n  });\n};\n\nconst setCooperationAcceptedBadge = tabId => {\n  chrome.browserAction.setBadgeBackgroundColor({\n    color: '#F93E2D',\n    tabId\n  });\n  chrome.browserAction.setBadgeText({\n    text: '\\u2691',\n    tabId\n  });\n  chrome.browserAction.setTitle({\n    title: window.censortracker.settings.getTitle(),\n    tabId\n  });\n};\n\nchrome.runtime.onInstalled.addListener(onInstalled);\nchrome.windows.onRemoved.addListener(onWindowsRemoved);\nchrome.runtime.onStartup.addListener(onStartup);\nchrome.webRequest.onErrorOccurred.addListener(onErrorOccurred, REQUEST_FILTERS);\nchrome.webRequest.onBeforeRequest.addListener(onBeforeRequest, REQUEST_FILTERS, ['blocking']);\nchrome.webRequest.onBeforeRedirect.addListener(onBeforeRedirect, {\n  urls: ['*://*/*']\n});\nchrome.webRequest.onCompleted.addListener(onCompleted, {\n  urls: ['*://*/*']\n});\nchrome.notifications.onButtonClicked.addListener(notificationOnButtonClicked);\nchrome.tabs.onActivated.addListener(updateState);\nchrome.tabs.onUpdated.addListener(updateState);\nsetInterval(() => {\n  window.censortracker.proxies.openPorts();\n}, 60 * 1000 * 3);\n\n//# sourceURL=webpack:///./src/chrome/js/background.js?");

/***/ })

/******/ });