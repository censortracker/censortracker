import DOMPurify from 'dompurify'

import browser from '../browser-api'
import {
  extractHostnameFromUrl,
  i18nGetMessage,
  isI2PUrl,
  isOnionUrl,
  isValidURL,
} from '../utilities'
import { sendConfigFetchMsg, sendExtensionCallMsg, sendTransitionMsg } from './messaging'

(async () => {
  const source = 'popup'

  const extensionIdlabel = document.getElementById('extension-id')

  extensionIdlabel.textContent = browser.runtime.id

  const premiumBadge = document.getElementById('premiumBadge')
  const popupPremiumSuggestion = document.getElementById('popupPremiumSuggestion')
  const popupPremiumSuggestionYoutube = document.getElementById('popupPremiumSuggestionYoutube')
  const youtubeToggle = document.getElementById('youtubeToggle')

  const statusImage = document.getElementById('statusImage')
  const disseminatorInfoBlock = document.getElementById('ori')
  const siteActions = document.getElementById('siteActions')
  const proxyingInfo = document.getElementById('proxying-info')
  const restrictionsInfoBlock = document.getElementById('restrictions')
  const detailsText = document.querySelectorAll('.details-text')
  const extensionIsOff = document.getElementById('extensionIsOff')
  const mainPageInfoBlocks = document.querySelectorAll('.main-page-info')
  const popupProxyStatusOk = document.getElementById('popupProxyStatusOk')
  const popupProxyDisabled = document.getElementById('popupProxyDisabled')
  const toggleSiteActionsButton = document.getElementById('toggleSiteActions')
  const siteActionDescription = document.getElementById(
    'siteActionDescription',
  )
  const popupProxyStatusError = document.getElementById(
    'popupProxyStatusError',
  )
  const footerExtensionIsOn = document.getElementById('footerExtensionIsOn')
  const currentDomainHeader = document.getElementById('currentDomainHeader')
  const proxyConnectionIssuesButton = document.getElementById(
    'proxyConnectionIssuesButton',
  )
  const backendIsIntermittentPopupMessage = document.getElementById(
    'backendIsIntermittentPopupMessage',
  )
  const privateBrowsingPermissionsRequiredButton = document.getElementById(
    'privateBrowsingPermissionsRequiredButton',
  )
  const torNetwork = document.getElementById('torNetwork')
  const i2pNetwork = document.getElementById('i2pNetwork')
  const openOptionsPage = document.getElementById('openOptionsPage')
  const highlightOptionsIcon = document.getElementById('highlightOptionsIcon')

  const {
    usePremiumProxy: isPremium,
    localConfig: { countryCode },
  } = await sendConfigFetchMsg(
    'usePremiumProxy',
    'localConfig',
  )

  document.addEventListener('click', async (event) => {
    // targetIdPossibleValues = 'disableExtension' | 'enableExtension'
    const targetId = event.target.id

    if (targetId === 'enableExtension') {
      sendTransitionMsg(targetId)
      window.location.reload()
    } else if (targetId === 'disableExtension') {
      sendTransitionMsg(targetId)
      mainPageInfoBlocks.forEach((element) => {
        element.hidden = true
      })
      window.location.reload()
    }
  })

  openOptionsPage.addEventListener('click', async (target) => {
    await browser.runtime.openOptionsPage()
  })

  // Highlight settings button when update is available.
  sendConfigFetchMsg('updateAvailable').then(({ updateAvailable }) => {
    if (updateAvailable) {
      highlightOptionsIcon.classList.remove('hidden')
    } else {
      highlightOptionsIcon.classList.add('hidden')
    }
  })

  // Highlight settings button when there are nothing to proxy.
  sendExtensionCallMsg(source, 'isRegistryEmpty').then((isEmpty) => {
    if (isEmpty) {
      highlightOptionsIcon.classList.remove('hidden')
    } else {
      highlightOptionsIcon.classList.add('hidden')
    }
  })

  // Show page with instructions about how to grand incognito access
  privateBrowsingPermissionsRequiredButton.addEventListener('click', () => {
    window.location.href = 'incognito-required-popup.html'
  })

  const controlledByOtherExtensionsButton = document.getElementById(
    'controlledByOtherExtensionsButton',
  )

  // Show page with list of conflicting extensions
  controlledByOtherExtensionsButton.addEventListener('click', () => {
    window.location.href = 'controlled.html'
  })

  backendIsIntermittentPopupMessage.addEventListener('click', async () => {
    await browser.runtime.openOptionsPage()
  })

  // Show proxying information
  sendConfigFetchMsg(
    'currentRegionName',
    'proxyServerURI',
    'customProxyServerURI',
    'proxyLastFetchTs',
  ).then(async (
    {
      currentRegionName,
      proxyServerURI,
      customProxyServerURI,
      proxyLastFetchTs,
    },
  ) => {
    if (proxyServerURI && proxyLastFetchTs) {
      const domains = await sendExtensionCallMsg(source, 'getDomains')
      const proxyServerId = proxyServerURI.split('.', 1)[0]
      const proxyingDetailsText = document.getElementById('proxyingDetailsText')
      const regionName = currentRegionName || i18nGetMessage('popupAutoMessage')
      const popupServerMsg = i18nGetMessage('popupServer')
      const popupYourRegion = i18nGetMessage('popupYourRegion')
      const popupTotalBlocked = i18nGetMessage('popupTotalBlocked')

      if (customProxyServerURI) {
        proxyingDetailsText.innerHTML = DOMPurify.sanitize(`<code><b>${popupServerMsg}:</b> — </code>`)
      } else {
        proxyingDetailsText.innerHTML = DOMPurify.sanitize(`<code><b>${popupServerMsg}:</b> ${proxyServerId}</code>`)
      }

      proxyingDetailsText.innerHTML += DOMPurify.sanitize(
        `<code><b>${popupYourRegion}:</b> ${regionName}</code>
        <code><b>${popupTotalBlocked}:</b> ${domains.length}</code>`)
    } else {
      // proxyingInfo.hidden = true
    }
  })

  // Hide all other expandable elements when actions are toggled
  toggleSiteActionsButton.addEventListener('click', async (event) => {
    if (event.target.classList.contains('icon-show')) {
      siteActions.classList.remove('hidden')
      event.target.classList.remove('icon-show')
      event.target.classList.add('icon-hide')
      disseminatorInfoBlock.classList.add('hidden')
      restrictionsInfoBlock.classList.add('hidden')
      proxyingInfo.classList.add('hidden')
    } else {
      siteActions.classList.add('hidden')
      event.target.classList.add('icon-show')
      event.target.classList.remove('icon-hide')
      disseminatorInfoBlock.classList.remove('hidden')
      restrictionsInfoBlock.classList.remove('hidden')
      proxyingInfo.classList.remove('hidden')
    }
  })

  browser.tabs.query({ active: true, lastFocusedWindow: true })
    .then(async (tabData) => {
      const currentUrl = tabData[0]?.url

      const { enableExtension: extensionEnabled } = await sendConfigFetchMsg('enableExtension')
      const currentHostname = extractHostnameFromUrl(currentUrl)

      sendConfigFetchMsg('useProxy', 'proxyIsAlive').then(
        ({ useProxy: proxyingEnabled, proxyIsAlive }) => {
          if (proxyingEnabled) {
            if (proxyIsAlive) {
              popupProxyStatusOk.hidden = false
              popupProxyStatusError.hidden = true
            } else {
              popupProxyStatusOk.hidden = true
              popupProxyStatusError.hidden = false
              proxyConnectionIssuesButton.hidden = false
              proxyConnectionIssuesButton.addEventListener('click', async () => {
                await browser.tabs.create({
                  url: 'https://t.me/censortracker_feedback',
                })
              })
            }
          } else {
            popupProxyDisabled.hidden = false
          }
        },
      )

      if (isValidURL(currentUrl)) {
        currentDomainHeader.innerText = currentHostname
        toggleSiteActionsButton.classList.remove('hidden')
        siteActionDescription.textContent = i18nGetMessage(
          'siteActionAutoDesc',
        )

        sendExtensionCallMsg(source, 'processHostName', { url: currentHostname }).then(
          ({ ignored, blocked }) => {
            if (ignored) {
              document.querySelector('input[value="never"]').checked = true
              siteActionDescription.textContent = i18nGetMessage(
                'siteActionNeverDesc',
              )
            } else if (blocked) {
              document.querySelector('input[value="always"]').checked = true
              siteActionDescription.textContent = i18nGetMessage(
                'siteActionAlwaysDesc',
              )
            } else {
              document.querySelector('input[value="auto"]').checked = true
              siteActionDescription.textContent = i18nGetMessage(
                'siteActionAutoDesc',
              )
            }
          },
        )

        if (!isPremium && currentHostname === 'www.youtube.com' && countryCode === 'RU') {
          popupPremiumSuggestionYoutube.classList.remove('hidden')
          const progressBar = document.getElementById('progressBar')

          progressBar.addEventListener('animationend', () => {
            youtubeToggle.classList.remove('hidden')
            youtubeToggle.classList.add('toggled')
          })
        } else if (isPremium) {
          premiumBadge.classList.remove('hidden')
        } else {
          popupPremiumSuggestion.classList.remove('hidden')
        }

        const siteActionRadioButtons = document.querySelectorAll(
          'input[name="site-action-radio"]',
        )

        for (const radioButton of siteActionRadioButtons) {
          radioButton.addEventListener('change', async (event) => {
            sendExtensionCallMsg(
              source,
              'changeIgnoredStatus', {
                url: currentUrl,
                newState: event.target.value,
              })

            const actionDescriptions = {
              always: 'siteActionAlwaysDesc',
              never: 'siteActionNeverDesc',
              auto: 'siteActionAutoDesc',
            }

            siteActionDescription.textContent = i18nGetMessage(
              actionDescriptions[event.target.value],
            )

            event.target.checked = true
          })
        }
      } else {
        const popupNewTabMessage = i18nGetMessage('popupNewTabMessage')

        currentDomainHeader.innerText = popupNewTabMessage

        if (popupNewTabMessage.length >= 25) {
          currentDomainHeader.style.fontSize = '15px'
        }
      }

      if (extensionEnabled) {
        statusImage.setAttribute('src', 'images/icons/512x512/normal.png')

        if (browser.isFirefox) {
          browser.extension.isAllowedIncognitoAccess()
            .then((allowedIncognitoAccess) => {
              sendConfigFetchMsg('privateBrowsingPermissionsRequired')
                .then(({ privateBrowsingPermissionsRequired }) => {
                  if (
                    !allowedIncognitoAccess ||
                    privateBrowsingPermissionsRequired
                  ) {
                    privateBrowsingPermissionsRequiredButton.hidden = false
                  }
                })
            })
        }

        if (currentHostname?.length >= 22 && currentHostname?.length < 25) {
          currentDomainHeader.style.fontSize = '17px'
        } else if (currentHostname?.length > 25 && currentHostname?.length < 30) {
          currentDomainHeader.style.fontSize = '15px'
        } else if (currentHostname?.length >= 30) {
          currentDomainHeader.style.fontSize = '13px'
        }

        currentDomainHeader.classList.add('title-normal')
        currentDomainHeader.removeAttribute('hidden')
        footerExtensionIsOn.removeAttribute('hidden')

        const { blocked, isDisseminator, cooperationRefused } =
          await sendExtensionCallMsg(source, 'processHostName', { url: currentHostname })

        if (blocked) {
          const restrictionsIcon = document.querySelector('#restrictions img')
          const restrictionsTitle = document.querySelector('#restrictions-title')
          const restrictionsDesc = document.querySelector('#restrictions-desc')

          restrictionsIcon.setAttribute('src', 'images/popup/status/info.svg')

          restrictionsTitle.textContent = i18nGetMessage('blockedTitle')
          statusImage.setAttribute('src', 'images/icons/512x512/ori.png')
          restrictionsWhatThisMeans.href = 'popup-details.html?reason=restrictions-blocked'
        }

        if (isDisseminator) {
          const oriTitle = document.querySelector('#ori-title')
          const oriDesc = document.querySelector('#ori-desc')
          const oriIcon = document.querySelector('#ori img')
          const oriDetails = document.querySelector('#ori-details')

          if (!cooperationRefused) {
            oriDetails.classList.add(['text-warning'])
            oriTitle.textContent = i18nGetMessage('disseminatorTitle')
            oriDesc.textContent = i18nGetMessage('disseminatorDesc')
            oriIcon.setAttribute('src', 'images/popup/status/danger.svg')
            statusImage.setAttribute('src', 'images/icons/512x512/ori.png')
            currentDomainHeader.classList.add('title-ori')
          } else {
            statusImage.setAttribute('src', 'images/icons/512x512/normal.png')
          }

          if (blocked) {
            if (cooperationRefused === false) {
              statusImage.setAttribute(
                'src',
                'images/icons/512x512/ori_blocked.png',
              )
            }
          }
        }

        if (isOnionUrl(currentUrl)) {
          torNetwork.hidden = false
          toggleSiteActionsButton.hidden = true
          restrictionsInfoBlock.classList.add('hidden')
          disseminatorInfoBlock.classList.add('hidden')
          proxyStatusIcon.classList.add('hidden')
          statusImage.setAttribute('src', 'images/icons/512x512/tor.png')
        } else if (isI2PUrl(currentUrl)) {
          i2pNetwork.hidden = false
          toggleSiteActionsButton.hidden = true
          restrictionsInfoBlock.classList.add('hidden')
          disseminatorInfoBlock.classList.add('hidden')
          proxyStatusIcon.classList.add('hidden')
          statusImage.setAttribute('src', 'images/icons/512x512/i2p.png')
        }
      } else {
        statusImage.setAttribute('src', 'images/icons/512x512/disabled.png')
        extensionIsOff.hidden = false
        toggleSiteActionsButton.hidden = true
        mainPageInfoBlocks.forEach((element) => {
          element.hidden = true
        })
      }
    })

  sendConfigFetchMsg('backendIsIntermittent')
    .then(({ backendIsIntermittent = false }) => {
      backendIsIntermittentPopupMessage.hidden = !backendIsIntermittent
    })

  sendExtensionCallMsg('controlled', 'controlledByOtherExtensions').then(
    (controlledByOtherExtensions) => {
      if (!browser.isFirefox && controlledByOtherExtensions) {
        controlledByOtherExtensionsButton.hidden = false
      }
    },
  )

  const hideDetails = () => {
    detailsText.forEach((element) => {
      element.style.display = 'none'
    })
  }

  const closeDetailsButtons = document.querySelectorAll('.btn-hide-details')
  const whatThisMeanButtons = document.querySelectorAll('.btn-what-this-mean')

  const showWhatThisMeanButtons = () => {
    whatThisMeanButtons.forEach((button) => {
      button.style.display = 'flex'
    })
  }

  for (const whatThisMeanButton of whatThisMeanButtons) {
    whatThisMeanButton.addEventListener('click', () => {
      hideDetails()
      showWhatThisMeanButtons()

      whatThisMeanButton.style.display = 'none'
      whatThisMeanButton.nextElementSibling.style.display = 'block'
    })
  }

  for (const closeButton of closeDetailsButtons) {
    closeButton.addEventListener('click', () => {
      hideDetails()
      showWhatThisMeanButtons()
    })
  }

  const show = () => {
    document.documentElement.style.visibility = 'initial'
  }

  setTimeout(show, 150)
})()
