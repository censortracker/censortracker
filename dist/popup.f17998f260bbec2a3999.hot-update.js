webpackHotUpdate("popup",{

/***/ "./node_modules/@babel/runtime/helpers/arrayLikeToArray.js":
false,

/***/ "./node_modules/@babel/runtime/helpers/arrayWithHoles.js":
false,

/***/ "./node_modules/@babel/runtime/helpers/asyncToGenerator.js":
false,

/***/ "./node_modules/@babel/runtime/helpers/iterableToArrayLimit.js":
false,

/***/ "./node_modules/@babel/runtime/helpers/nonIterableRest.js":
false,

/***/ "./node_modules/@babel/runtime/helpers/slicedToArray.js":
false,

/***/ "./node_modules/@babel/runtime/helpers/unsupportedIterableToArray.js":
false,

/***/ "./node_modules/@babel/runtime/regenerator/index.js":
false,

/***/ "./node_modules/regenerator-runtime/runtime.js":
false,

/***/ "./src/chrome/js/ui/popup.js":
/*!***********************************!*\
  !*** ./src/chrome/js/ui/popup.js ***!
  \***********************************/
/*! no static exports found */
/***/ (function(module, exports) {

eval("// const getElementById = (id) => document.getElementById(id)\n//\n// const statusImage = getElementById('statusImage')\n// const currentDomainHeader = getElementById('currentDomainHeader')\n// const footerTrackerOff = getElementById('footerTrackerOff')\n// const trackerOff = getElementById('trackerOff')\n// const isOriBlock = getElementById('isOriBlock')\n// const isNotOriBlock = getElementById('isNotOriBlock')\n// const isForbidden = getElementById('isForbidden')\n// const isNotForbidden = getElementById('isNotForbidden')\n// const footerTrackerOn = getElementById('footerTrackerOn')\n// const aboutOriButton = getElementById('aboutOriButton')\n// const textAboutOri = getElementById('textAboutOri')\n// const closeTextAboutOri = getElementById('closeTextAboutOri')\n// const btnAboutForbidden = getElementById('btnAboutForbidden')\n// const textAboutForbidden = getElementById('textAboutForbidden')\n// const closeTextAboutForbidden = getElementById('closeTextAboutForbidden')\n// const btnAboutNotForbidden = getElementById('btnAboutNotForbidden')\n// const textAboutNotForbidden = getElementById('textAboutNotForbidden')\n// const closeTextAboutNotForbidden = getElementById('closeTextAboutNotForbidden')\n// const btnAboutNotOri = getElementById('btnAboutNotOri')\n// const textAboutNotOri = getElementById('textAboutNotOri')\n// const closeTextAboutNotOri = getElementById('closeTextAboutNotOri')\n// const oriSiteInfo = getElementById('oriSiteInfo')\n// const advertisingBlocks = document.querySelectorAll('.buy-vpn')\n// const currentDomainBlocks = document.querySelectorAll('.current-domain')\n// const popupShowTimeout = 60\n//\n// chrome.runtime.getBackgroundPage(async ({ censortracker: bgModules }) => {\n//   const { asynchrome, registry } = bgModules\n//\n//   await addExtensionControlListeners(bgModules)\n//\n//   const { enableExtension } = await asynchrome.storage.local.get({\n//     enableExtension: true,\n//   })\n//\n//   const [{ url: currentURL }] = await asynchrome.tabs.query({\n//     active: true, lastFocusedWindow: true,\n//   })\n//\n//   const { hostname } = getAppropriateURL(currentURL)\n//   const currentHostname = bgModules.extractHostnameFromUrl(hostname)\n//\n//   interpolateCurrentDomain(currentHostname)\n//\n//   if (enableExtension) {\n//     changeStatusImage('normal')\n//     renderCurrentDomain(currentHostname)\n//     footerTrackerOn.removeAttribute('hidden')\n//\n//     const { domainFound } = await registry.domainsContains(currentHostname)\n//\n//     if (domainFound) {\n//       changeStatusImage('blocked')\n//       isForbidden.removeAttribute('hidden')\n//       isNotForbidden.remove()\n//       showAdvertising()\n//     } else {\n//       isNotForbidden.removeAttribute('hidden')\n//       isForbidden.remove()\n//       changeStatusImage('normal')\n//     }\n//\n//     const { url: distributorUrl, cooperationRefused } =\n//       await registry.distributorsContains(currentHostname)\n//\n//     if (distributorUrl) {\n//       currentDomainHeader.classList.add('title-ori')\n//       isOriBlock.removeAttribute('hidden')\n//       isNotOriBlock.remove()\n//\n//       if (cooperationRefused) {\n//         showCooperationRefusedMessage()\n//       } else {\n//         changeStatusImage('ori')\n//         console.warn('Cooperation accepted!')\n//       }\n//     } else {\n//       isNotOriBlock.removeAttribute('hidden')\n//       isOriBlock.remove()\n//       console.log('Match not found at all')\n//     }\n//\n//     if (domainFound && distributorUrl) {\n//       if (cooperationRefused === false) {\n//         changeStatusImage('ori_blocked')\n//       }\n//     }\n//   } else {\n//     hideControlElements()\n//   }\n//\n//   const show = () => {\n//     document.documentElement.style.visibility = 'initial'\n//   }\n//\n//   setTimeout(show, popupShowTimeout)\n// })\n//\n// const addExtensionControlListeners = async ({ settings, proxies, chromeListeners }) => {\n//   document.addEventListener('click', (event) => {\n//     if (event.target.matches('#enableExtension')) {\n//       settings.enableExtension()\n//       proxies.setProxy()\n//       chromeListeners.add()\n//       window.location.reload()\n//     }\n//\n//     if (event.target.matches('#disableExtension')) {\n//       proxies.removeProxy()\n//       settings.disableExtension()\n//       chromeListeners.remove()\n//       window.location.reload()\n//     }\n//   })\n// }\n//\n// const changeStatusImage = (imageName) => {\n//   const imageSrc = chrome.runtime.getURL(`images/icons/512x512/${imageName}.png`)\n//\n//   statusImage.setAttribute('src', imageSrc)\n// }\n//\n// const showAdvertising = () => {\n//   advertisingBlocks.forEach((ad) => {\n//     ad.style.removeProperty('display')\n//   })\n// }\n//\n// const getAppropriateURL = (currentURL) => {\n//   const popupURL = chrome.runtime.getURL('popup.html')\n//\n//   if (currentURL.startsWith(popupURL)) {\n//     const currentURLParams = currentURL.split('?')[1]\n//     const searchParams = new URLSearchParams(currentURLParams)\n//     const encodedURL = searchParams.get('loadFor')\n//     const loadForURL = window.atob(encodedURL)\n//\n//     return new URL(loadForURL)\n//   }\n//   return new URL(currentURL)\n// }\n//\n// const interpolateCurrentDomain = (domain) => {\n//   currentDomainBlocks.forEach((element) => {\n//     element.innerText = domain\n//   })\n// }\n//\n// const renderCurrentDomain = ({ length }) => {\n//   if (length >= 22 && length < 25) {\n//     currentDomainHeader.style.fontSize = '17px'\n//   } else if (length >= 25) {\n//     currentDomainHeader.style.fontSize = '15px'\n//   }\n//   currentDomainHeader.classList.add('title-normal')\n//   currentDomainHeader.removeAttribute('hidden')\n// }\n//\n// const showCooperationRefusedMessage = () => {\n//   oriSiteInfo.innerText = 'Сервис заявил, что они не передают трафик российским ' +\n//     'государственным органам в автоматическом режиме.'\n//   textAboutOri.classList.remove('text-warning')\n//   textAboutOri.classList.add('text-normal')\n//   currentDomainHeader.classList.remove('title-ori')\n//   currentDomainHeader.classList.add('title-normal')\n// }\n//\n// const hideControlElements = () => {\n//   changeStatusImage('disabled')\n//   trackerOff.hidden = false\n//   footerTrackerOff.hidden = false\n//   isOriBlock.hidden = true\n//   isForbidden.hidden = true\n//   isNotOriBlock.hidden = true\n//   isNotForbidden.hidden = true\n// }\n//\n// aboutOriButton.addEventListener('click', () => {\n//   textAboutOri.style.display = 'block'\n//   aboutOriButton.style.display = 'none'\n//   hideForbiddenDetails()\n// })\n//\n// btnAboutNotOri.addEventListener('click', () => {\n//   textAboutNotOri.style.display = 'block'\n//   btnAboutNotOri.style.display = 'none'\n//   hideForbiddenDetails()\n// })\n//\n// closeTextAboutNotOri.addEventListener('click', () => {\n//   textAboutNotOri.style.display = 'none'\n//   btnAboutNotOri.style.display = 'flex'\n// },\n// )\n//\n// closeTextAboutOri.addEventListener('click', () => {\n//   textAboutOri.style.display = 'none'\n//   aboutOriButton.style.display = 'flex'\n// },\n// )\n//\n// btnAboutForbidden.addEventListener('click', () => {\n//   textAboutForbidden.style.display = 'block'\n//   btnAboutForbidden.style.display = 'none'\n//   hideOriDetails()\n// },\n// )\n//\n// btnAboutNotForbidden.addEventListener('click', () => {\n//   textAboutNotForbidden.style.display = 'block'\n//   btnAboutNotForbidden.style.display = 'none'\n//   hideOriDetails()\n// })\n//\n// closeTextAboutForbidden.addEventListener('click', () => {\n//   textAboutForbidden.style.display = 'none'\n//   btnAboutForbidden.style.display = 'flex'\n// },\n// )\n//\n// closeTextAboutNotForbidden.addEventListener('click', () => {\n//   textAboutNotForbidden.style.display = 'none'\n//   btnAboutNotForbidden.style.display = 'flex'\n// })\n//\n// const hideOriDetails = () => {\n//   textAboutOri.style.display = 'none'\n//   aboutOriButton.style.display = 'flex'\n//   textAboutNotOri.style.display = 'none'\n//   btnAboutNotOri.style.display = 'flex'\n// }\n//\n// const hideForbiddenDetails = () => {\n//   textAboutForbidden.style.display = 'none'\n//   btnAboutForbidden.style.display = 'flex'\n//   textAboutNotForbidden.style.display = 'none'\n//   btnAboutNotForbidden.style.display = 'flex'\n// }\n\n//# sourceURL=webpack:///./src/chrome/js/ui/popup.js?");

/***/ })

})