import browser from '../browser-api'
import {
  extractHostnameFromUrl,
  getDomainFontSize,
  i18nGetMessage,
  isI2PUrl,
  isOnionUrl,
  isValidURL,
} from '../utilities'
import { sendConfigFetchMsg, sendExtensionCallMsg, sendTransitionMsg } from './messaging'

(async () => {
  const source = 'popup'
  // eslint-disable-next-line no-unused-vars
  let worksCorrectly = true
  const extensionIdlabel = document.getElementById('extension-id')

  extensionIdlabel.textContent = browser.runtime.id

  const premiumBadge = document.getElementById('premiumBadge')
  const popupPremiumSuggestion = document.getElementById('popupPremiumSuggestion')
  const popupPremiumSuggestionYoutube = document.getElementById('popupPremiumSuggestionYoutube')
  const youtubeToggle = document.getElementById('youtubeToggle')

  const statusImage = document.getElementById('statusImage')
  const disseminatorInfoBlock = document.getElementById('ori')
  const siteActions = document.getElementById('siteActions')
  const siteActionsDone = document.getElementById('siteActionsDone')
  const restrictionsInfoBlock = document.getElementById('restrictions')
  const restrictionsWhatThisMeans = document.querySelector('#restrictions .btn-what-this-mean')
  const oriWhatThisMeans = document.querySelector('#ori .btn-what-this-mean')
  const extensionIsOff = document.getElementById('extensionIsOff')
  const mainPageInfoBlocks = document.querySelectorAll('.main-page-info')
  const popupProxyStatusOk = document.getElementById('popupProxyStatusOk')
  const popupProxyDisabled = document.getElementById('popupProxyDisabled')
  const toggleSiteActionsButton = document.getElementById('toggleSiteActions')
  const proxyStatusIcon = document.getElementById('proxyStatusIcon')
  const siteActionDescription = document.getElementById('siteActionDescription')
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
    window.location.href = 'popup-details.html?reason=permissions'
  })

  const controlledByOtherExtensionsButton = document.getElementById(
    'controlledByOtherExtensionsButton',
  )

  // Show page with list of conflicting extensions
  controlledByOtherExtensionsButton.addEventListener('click', () => {
    window.location.href = 'popup-details.html?reason=control'
  })

  backendIsIntermittentPopupMessage.addEventListener('click', async () => {
    await browser.runtime.openOptionsPage()
  })

  if (isPremium) {
    premiumBadge.classList.remove('hidden')
  }

  siteActionsDone.addEventListener('click', async (event) => {
    siteActions.classList.add('hidden')
    toggleSiteActionsButton.classList.add('icon-show')
    toggleSiteActionsButton.classList.remove('icon-hide')
    disseminatorInfoBlock.classList.remove('hidden')
    restrictionsInfoBlock.classList.remove('hidden')
    proxyStatusIcon.classList.remove('hidden')
  })

  // Hide all other expandable elements when actions are toggled
  toggleSiteActionsButton.addEventListener('click', async (event) => {
    if (event.currentTarget.classList.contains('icon-show')) {
      siteActions.classList.remove('hidden')
      event.currentTarget.classList.remove('icon-show')
      event.currentTarget.classList.add('icon-hide')
      disseminatorInfoBlock.classList.add('hidden')
      restrictionsInfoBlock.classList.add('hidden')
      proxyStatusIcon.classList.add('hidden')
    } else {
      siteActions.classList.add('hidden')
      event.currentTarget.classList.add('icon-show')
      event.currentTarget.classList.remove('icon-hide')
      disseminatorInfoBlock.classList.remove('hidden')
      restrictionsInfoBlock.classList.remove('hidden')
      proxyStatusIcon.classList.remove('hidden')
    }
  })

  const { backendIsIntermittent = false } = await sendConfigFetchMsg('backendIsIntermittent')

  backendIsIntermittentPopupMessage.hidden = !backendIsIntermittent
  worksCorrectly = !backendIsIntermittent

  const controlledByOtherExtensions = await sendExtensionCallMsg('controlled', 'controlledByOtherExtensions')

  if (!browser.isFirefox && controlledByOtherExtensions) {
    controlledByOtherExtensionsButton.hidden = false
    worksCorrectly = false
  }

  browser.tabs.query({ active: true, lastFocusedWindow: true })
    .then(async (tabData) => {
      const currentUrl = tabData[0]?.url

      const { enableExtension: extensionEnabled } = await sendConfigFetchMsg('enableExtension')
      const currentHostname = extractHostnameFromUrl(currentUrl)

      sendConfigFetchMsg('useProxy', 'proxyIsAlive', 'usePremiumProxy').then(
        ({ useProxy: proxyingEnabled, proxyIsAlive, usePremiumProxy }) => {
          if (proxyingEnabled) {
            if (proxyIsAlive) {
              proxyStatusIcon.hidden = false
              popupProxyStatusOk.hidden = false
              popupProxyStatusError.hidden = true
              proxyStatusIcon.href = usePremiumProxy ? 'premium-proxy.html' : 'proxy-options.html'
            } else {
              proxyStatusIcon.hidden = true
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
            proxyStatusIcon.hidden = false
            popupProxyDisabled.hidden = false
            proxyStatusIcon.href = 'proxy-options.html'
            proxyStatusIcon.setAttribute('target', '_blank')
          }
        },
      )

      if (isValidURL(currentUrl)) {
        currentDomainHeader.innerText = currentHostname
        if (extensionEnabled) {
          toggleSiteActionsButton.classList.remove('hidden')
        }

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
            } else if (blocked || isPremium) {
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

        const siteActionsRadioGroup = document.getElementById('siteActionsRadioGroup')

        siteActionsRadioGroup.addEventListener('change', async (event) => {
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
                    worksCorrectly = false
                    privateBrowsingPermissionsRequiredButton.hidden = false
                  }
                })
            })
        }

        currentDomainHeader.style.fontSize = getDomainFontSize(currentHostname)

        currentDomainHeader.classList.add('title-normal')
        currentDomainHeader.removeAttribute('hidden')
        footerExtensionIsOn.removeAttribute('hidden')

        const { blocked, isDisseminator, cooperationRefused } =
          await sendExtensionCallMsg(source, 'processHostName', { url: currentHostname })

        if (blocked) {
          const restrictionsIcon = document.querySelector('#restrictions img')
          const restrictionsTitle = document.querySelector('#restrictions-title')

          restrictionsIcon.setAttribute('src', 'images/popup/status/info.svg')

          restrictionsTitle.textContent = i18nGetMessage('blockedTitle')
          statusImage.setAttribute('src', 'images/icons/512x512/ori.png')
          restrictionsWhatThisMeans.href = 'popup-details.html?reason=restrictions-blocked'
        }

        if (isDisseminator) {
          const oriTitle = document.querySelector('#ori-title')
          const oriIcon = document.querySelector('#ori img')

          if (!cooperationRefused) {
            oriTitle.textContent = i18nGetMessage('disseminatorTitle')
            oriIcon.setAttribute('src', 'images/popup/status/danger.svg')
            statusImage.setAttribute('src', 'images/icons/512x512/ori.png')
            currentDomainHeader.classList.add('title-ori')
            oriWhatThisMeans.href = 'popup-details.html?reason=ori-disseminator'
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

        if (worksCorrectly && !isPremium && currentHostname === 'www.youtube.com' && countryCode === 'RU') {
          popupPremiumSuggestionYoutube.classList.remove('hidden')
          const progressBar = document.getElementById('progressBar')

          progressBar.addEventListener('animationend', () => {
            youtubeToggle.classList.remove('hidden')
            youtubeToggle.classList.add('toggled')
          })
        } else if (worksCorrectly && !isPremium) {
          popupPremiumSuggestion.classList.remove('hidden')
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

  const show = () => {
    document.documentElement.style.visibility = 'initial'
  }

  setTimeout(show, 150)
})()
