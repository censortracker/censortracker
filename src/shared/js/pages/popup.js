import Browser from 'Background/browser-api'
import Ignore from 'Background/ignore'
import ProxyManager from 'Background/proxy'
import Registry from 'Background/registry'
import Settings from 'Background/settings'
import {
  extractHostnameFromUrl,
  i18nGetMessage,
  isI2PUrl,
  isOnionUrl,
  isValidURL,
} from 'Background/utilities';

(async () => {
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

  document.addEventListener('click', async (event) => {
    const targetId = event.target.id

    if (targetId === 'enableExtension') {
      await Settings.enableExtension()
      await Settings.enableNotifications()
      await ProxyManager.enableProxy()
      window.location.reload()
    } else if (targetId === 'disableExtension') {
      await Settings.disableExtension()
      mainPageInfoBlocks.forEach((element) => {
        element.hidden = true
      })
      window.location.reload()
    }
  })

  openOptionsPage.addEventListener('click', async (target) => {
    await Browser.runtime.openOptionsPage()
  })

  // Highlight settings button when update is available.
  Browser.storage.local.get({ updateAvailable: false })
    .then(({ updateAvailable }) => {
      if (updateAvailable) {
        highlightOptionsIcon.classList.remove('hidden')
      } else {
        highlightOptionsIcon.classList.add('hidden')
      }
    })

  // Highlight settings button when there are nothing to proxy.
  Registry.isEmpty().then((isEmpty) => {
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
    await Browser.runtime.openOptionsPage()
  })

  // Show proxying information
  Browser.storage.local.get(['currentRegionName', 'proxyServerURI', 'proxyLastFetchTs'])
    .then(async ({ currentRegionName, proxyServerURI, proxyLastFetchTs }) => {
      if (proxyServerURI && proxyLastFetchTs) {
        const domains = await Registry.getDomains()
        const proxyServerId = proxyServerURI.split('.', 1)[0]
        const proxyingDetailsText = document.getElementById('proxyingDetailsText')
        const regionName = currentRegionName || i18nGetMessage('popupAutoMessage')
        const popupServerMsg = i18nGetMessage('popupServer')
        const popupYourRegion = i18nGetMessage('popupYourRegion')
        const popupTotalBlocked = i18nGetMessage('popupTotalBlocked')

        proxyingDetailsText.innerHTML = `
          <code><b>${popupServerMsg}:</b> ${proxyServerId}</code>
          <code><b>${popupYourRegion}:</b> ${regionName}</code>
          <code><b>${popupTotalBlocked}:</b> ${domains.length}</code>
        `
      } else {
        proxyingInfo.hidden = true
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

  Browser.tabs.query({ active: true, lastFocusedWindow: true })
    .then(async ([{ url: currentUrl, id: tabId }]) => {
      const proxyingEnabled = await ProxyManager.isEnabled()
      const extensionEnabled = await Settings.extensionEnabled()
      const currentHostname = extractHostnameFromUrl(currentUrl)

      ProxyManager.alive().then((alive) => {
        if (proxyingEnabled) {
          if (alive) {
            popupProxyStatusOk.hidden = false
            popupProxyStatusError.hidden = true
          } else {
            popupProxyStatusOk.hidden = true
            popupProxyStatusError.hidden = false
            proxyConnectionIssuesButton.hidden = false
            proxyConnectionIssuesButton.addEventListener('click', async () => {
              await Browser.tabs.create({
                url: 'https://t.me/censortracker_feedback',
              })
            })
          }
        } else {
          popupProxyDisabled.hidden = false
        }
      })

      if (isValidURL(currentUrl)) {
        currentDomainHeader.innerText = currentHostname
        toggleSiteActionsButton.classList.remove('hidden')
        siteActionDescription.textContent = i18nGetMessage(
          'siteActionAutoDesc',
        )

        Ignore.contains(currentUrl).then((ignored) => {
          if (ignored) {
            document.querySelector('input[value="never"]').checked = true
            siteActionDescription.textContent = i18nGetMessage(
              'siteActionNeverDesc',
            )
          } else {
            Registry.contains(currentUrl).then((blocked) => {
              if (blocked) {
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
            })
          }
        })

        const siteActionRadioButtons = document.querySelectorAll(
          'input[name="site-action-radio"]',
        )

        for (const radioButton of siteActionRadioButtons) {
          radioButton.addEventListener('change', async (event) => {
            if (event.target.value === 'always') {
              siteActionDescription.textContent = i18nGetMessage(
                'siteActionAlwaysDesc',
              )
              Ignore.remove(currentUrl).then((removed) => {
                if (removed) {
                  Registry.add(currentUrl).then((added) => {
                    console.warn('Proxying strategy was changed to: "always"')
                  })
                }
              })
            } else if (event.target.value === 'never') {
              await Ignore.add(currentUrl)
              await Registry.remove(currentUrl)
              siteActionDescription.textContent = i18nGetMessage(
                'siteActionNeverDesc',
              )
            } else {
              await Ignore.remove(currentUrl)
              await Registry.remove(currentUrl)
              siteActionDescription.textContent = i18nGetMessage(
                'siteActionAutoDesc',
              )
            }

            await ProxyManager.setProxy()

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

        if (Browser.IS_FIREFOX) {
          Browser.extension.isAllowedIncognitoAccess()
            .then((allowedIncognitoAccess) => {
              Browser.storage.local
                .get({ privateBrowsingPermissionsRequired: false })
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

        if (currentHostname.length >= 22 && currentHostname.length < 25) {
          currentDomainHeader.style.fontSize = '17px'
        } else if (currentHostname.length > 25 && currentHostname.length < 30) {
          currentDomainHeader.style.fontSize = '15px'
        } else if (currentHostname.length >= 30) {
          currentDomainHeader.style.fontSize = '13px'
        }

        currentDomainHeader.classList.add('title-normal')
        currentDomainHeader.removeAttribute('hidden')
        footerExtensionIsOn.removeAttribute('hidden')

        const restrictionsFound = await Registry.contains(currentHostname)

        if (restrictionsFound) {
          const restrictionsIcon = document.querySelector('#restrictions img')
          const restrictionsTitle = document.querySelector('#restrictions-title')
          const restrictionsDesc = document.querySelector('#restrictions-desc')

          restrictionsIcon.setAttribute('src', 'images/popup/status/info.svg')

          restrictionsTitle.textContent = i18nGetMessage('blockedTitle')
          restrictionsDesc.textContent = i18nGetMessage('blockedDesc')
          statusImage.setAttribute('src', 'images/icons/512x512/blocked.png')
        }

        Registry.retrieveDisseminator(currentHostname)
          .then(({ url: disseminatorUrl, cooperationRefused }) => {
            if (disseminatorUrl) {
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
                oriDesc.textContent = i18nGetMessage('disseminatorCoopRefused')
                statusImage.setAttribute('src', 'images/icons/512x512/normal.png')
              }

              if (restrictionsFound) {
                if (cooperationRefused === false) {
                  statusImage.setAttribute(
                    'src',
                    'images/icons/512x512/ori_blocked.png',
                  )
                }
              }
            }
          })

        if (isOnionUrl(currentUrl)) {
          torNetwork.hidden = false
          toggleSiteActionsButton.hidden = true
          restrictionsInfoBlock.classList.add('hidden')
          disseminatorInfoBlock.classList.add('hidden')
          proxyingInfo.classList.add('hidden')
          statusImage.setAttribute('src', 'images/icons/512x512/tor.png')
        } else if (isI2PUrl(currentUrl)) {
          i2pNetwork.hidden = false
          toggleSiteActionsButton.hidden = true
          restrictionsInfoBlock.classList.add('hidden')
          disseminatorInfoBlock.classList.add('hidden')
          proxyingInfo.classList.add('hidden')
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

  Browser.storage.local.get('backendIsIntermittent')
    .then(({ backendIsIntermittent = false }) => {
      backendIsIntermittentPopupMessage.hidden = !backendIsIntermittent
    })

  ProxyManager.controlledByOtherExtensions().then(
    (controlledByOtherExtensions) => {
      if (!Browser.IS_FIREFOX && controlledByOtherExtensions) {
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
