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
/******/ 	return __webpack_require__(__webpack_require__.s = "./src/chrome/js/ui/popup.js");
/******/ })
/************************************************************************/
/******/ ({

/***/ "./src/chrome/js/ui/popup.js":
/*!***********************************!*\
  !*** ./src/chrome/js/ui/popup.js ***!
  \***********************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("// window.jQuery('body').tooltip({\n//   selector: '[data-toggle=\"tooltip\"]',\n// })\nvar statusImage = document.querySelector('#statusImage');\nvar popupFooter = document.querySelector('#popupFooter');\nvar lastSyncDate = document.querySelector('#lastSyncDate');\nvar oriMatchFound = document.querySelector('#oriMatchFound');\nvar registryMatchFound = document.querySelector('#matchFound');\nvar vpnAdvertising = document.querySelector('#vpnAdvertising');\nvar extensionStatus = document.querySelector('#extensionStatus');\nvar extensionStatusLabel = document.querySelector('#extensionStatusLabel');\nvar cooperationAccepted = document.querySelector('#cooperationAccepted');\nvar cooperationRejected = document.querySelector('#cooperationRejected');\nvar currentDomain = document.querySelector('#currentDomain');\nvar extensionName = document.querySelector('#extensionName');\nvar redIcon = chrome.extension.getURL('images/red_icon.png');\nchrome.runtime.getBackgroundPage(function (bgWindow) {\n  extensionName.innerText = bgWindow.censortracker.settings.getTitle();\n\n  var updateExtensionStatusLabel = function updateExtensionStatusLabel() {\n    var labelText = 'Расширение выключено';\n    var tooltipStatus = 'выключен';\n    var extName = bgWindow.censortracker.settings.getName();\n\n    if (extensionStatus.checked) {\n      labelText = 'Расширение включено';\n      tooltipStatus = 'включен';\n    }\n\n    extensionStatusLabel.innerText = labelText;\n    extensionStatusLabel.setAttribute('title', \"\".concat(extName, \" \").concat(tooltipStatus));\n  };\n\n  document.addEventListener('click', function (event) {\n    if (event.target.matches(\"#\".concat(extensionStatus.id))) {\n      updateExtensionStatusLabel();\n\n      if (extensionStatus.checked) {\n        popupFooter.hidden = false;\n        bgWindow.censortracker.shortcuts.enableExtension();\n        bgWindow.censortracker.proxies.setProxy();\n      } else {\n        popupFooter.hidden = true;\n        bgWindow.censortracker.proxies.removeProxy();\n        bgWindow.censortracker.shortcuts.disableExtension();\n      }\n    }\n  });\n  chrome.storage.local.get({\n    enableExtension: true\n  }, function (config) {\n    if (config.enableExtension) {\n      extensionStatus.checked = config.enableExtension;\n    }\n  });\n  chrome.tabs.query({\n    active: true,\n    lastFocusedWindow: true\n  }, function (tabs) {\n    var activeTab = tabs[0];\n    var activeTabUrl = activeTab.url;\n\n    if (activeTabUrl.startsWith('chrome-extension://')) {\n      popupFooter.hidden = true;\n      return;\n    }\n\n    var urlObject = new URL(activeTabUrl);\n    var currentHostname = bgWindow.censortracker.shortcuts.cleanHostname(urlObject.hostname);\n    chrome.storage.local.get({\n      enableExtension: true\n    }, function (config) {\n      if (bgWindow.censortracker.shortcuts.validURL(currentHostname)) {\n        currentDomain.innerText = currentHostname.replace('www.', '');\n      }\n\n      updateExtensionStatusLabel();\n\n      if (config.enableExtension) {\n        bgWindow.censortracker.registry.getLastSyncTimestamp().then(function (timestamp) {\n          lastSyncDate.innerText = timestamp.replace(/\\//g, '.');\n        });\n        bgWindow.censortracker.registry.checkDomains(currentHostname, {\n          onMatchFound: function onMatchFound(_data) {\n            registryMatchFound.innerHTML = bgWindow.censortracker.shortcuts.createSearchLink(currentHostname);\n            vpnAdvertising.hidden = false;\n            statusImage.setAttribute('src', redIcon);\n          }\n        });\n        bgWindow.censortracker.registry.checkDistributors(currentHostname, {\n          onMatchFound: function onMatchFound(cooperationRefused) {\n            oriMatchFound.innerHTML = bgWindow.censortracker.shortcuts.createSearchLink(currentHostname);\n            vpnAdvertising.hidden = false;\n            statusImage.setAttribute('src', redIcon);\n\n            if (cooperationRefused) {\n              cooperationRejected.hidden = false;\n            } else {\n              cooperationAccepted.hidden = false;\n            }\n          }\n        });\n      } else {\n        popupFooter.hidden = true;\n      }\n    });\n  });\n\n  var show = function show() {\n    document.documentElement.style.visibility = 'initial';\n  };\n\n  setTimeout(show, 165);\n});\n\n//# sourceURL=webpack:///./src/chrome/js/ui/popup.js?");

/***/ })

/******/ });