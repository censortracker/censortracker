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
} from 'Background/utilities'

;

(async () => {
  const uiText = {
    ori: {
      found: {
        title: i18nGetMessage('disseminatorTitle'),
        statusIcon: 'images/popup/status/danger.svg',
        detailsText: i18nGetMessage('disseminatorDesc'),
        detailsClasses: ['text-warning'],
        cooperationRefused: {
          message: i18nGetMessage('disseminatorCoopRefused'),
        },
      },
      notFound: {
        statusIcon: 'images/popup/status/ok.svg',
        title: i18nGetMessage('notDisseminatorTitle'),
        detailsText: i18nGetMessage('notDisseminatorDesc'),
      },
    },
    restrictions: {
      true: {
        statusIcon: 'images/popup/status/info.svg',
        title: i18nGetMessage('blockedTitle'),
        detailsText: i18nGetMessage('blockedDesc'),
      },
      false: {
        statusIcon: 'images/popup/status/ok.svg',
        title: i18nGetMessage('notBlockedTitle'),
        detailsText: i18nGetMessage('notBlockedDesc'),
      },
    },
  }
  const statusImage = document.getElementById('statusImage')
  const disseminatorInfoBlock = document.getElementById('ori')
  const siteActions = document.getElementById('siteActions')
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
  const closeDetailsButtons = document.querySelectorAll('.btn-hide-details')
  const whatThisMeanButtons = document.querySelectorAll('.btn-what-this-mean')
  const proxyConnectionIssuesButton = document.getElementById(
    'proxyConnectionIssuesButton',
  )
  const controlledByOtherExtensionsButton = document.getElementById(
    'controlledByOtherExtensionsButton',
  )
  const backendIsIntermittentPopupMessage = document.getElementById(
    'backendIsIntermittentPopupMessage',
  )
  const privateBrowsingPermissionsRequiredButton = document.getElementById(
    'privateBrowsingPermissionsRequiredButton',
  )

  const torNetwork = document.getElementById('torNetwork')
  const i2pNetwork = document.getElementById('i2pNetwork')

  document
    .getElementById('enableExtension')
    .addEventListener('click', async (target) => {
      await Settings.enableExtension()
      await Settings.enableNotifications()
      await ProxyManager.enableProxy()
      window.location.reload()
    })

  document
    .getElementById('disableExtension')
    .addEventListener('click', async (target) => {
      await Settings.disableExtension()
      mainPageInfoBlocks.forEach((element) => {
        element.hidden = true
      })
      window.location.reload()
    })

  document
    .getElementById('openOptionsPage')
    .addEventListener('click', async (target) => {
      await Browser.runtime.openOptionsPage()
    })

  privateBrowsingPermissionsRequiredButton.addEventListener('click', () => {
    window.location.href = 'incognito-required-popup.html'
  })

  controlledByOtherExtensionsButton.addEventListener('click', () => {
    window.location.href = 'controlled.html'
  })

  backendIsIntermittentPopupMessage.addEventListener('click', async () => {
    await Browser.runtime.openOptionsPage()
  })

  Browser.tabs
    .query({ active: true, lastFocusedWindow: true })
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

        toggleSiteActionsButton.addEventListener('click', async (event) => {
          if (event.target.classList.contains('icon-show')) {
            siteActions.classList.remove('hidden')
            event.target.classList.remove('icon-show')
            event.target.classList.add('icon-hide')
            disseminatorInfoBlock.classList.add('hidden')
            restrictionsInfoBlock.classList.add('hidden')
          } else {
            siteActions.classList.add('hidden')
            event.target.classList.add('icon-show')
            event.target.classList.remove('icon-hide')
            disseminatorInfoBlock.classList.remove('hidden')
            restrictionsInfoBlock.classList.remove('hidden')
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
          Browser.extension
            .isAllowedIncognitoAccess()
            .then((allowedIncognitoAccess) => {
              Browser.storage.local
                .get({
                  privateBrowsingPermissionsRequired: false,
                })
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

        document
          .querySelectorAll('#restrictions [data-render-var]')
          .forEach((el) => {
            const renderVar = el.dataset.renderVar
            const value = uiText.restrictions[restrictionsFound][renderVar]

            if (restrictionsFound && proxyingEnabled) {
              statusImage.setAttribute(
                'src',
                'images/icons/512x512/blocked.png',
              )
            }

            if (renderVar === 'statusIcon') {
              el.setAttribute('src', value)
            } else {
              el.innerText = value
            }
          })

        const { url: disseminatorUrl, cooperationRefused } =
          await Registry.retrieveDisseminator(currentHostname)

        if (disseminatorUrl) {
          if (!cooperationRefused) {
            statusImage.setAttribute('src', 'images/icons/512x512/ori.png')
            currentDomainHeader.classList.add('title-ori')

            for (const element of document.querySelectorAll(
              '#ori [data-render-var]',
            )) {
              const renderVar = element.dataset.renderVar
              const value = uiText.ori.found[renderVar]

              if (renderVar === 'statusIcon') {
                element.setAttribute('src', value)
              } else if (renderVar === 'detailsClasses') {
                element.classList.add(uiText.ori.found.detailsClasses)
              } else {
                element.innerText = value
              }
            }
          } else {
            const [disseminatorDetailsText] = document.querySelectorAll(
              '#ori [data-render-var="detailsText"]',
            )

            disseminatorDetailsText.innerText =
              uiText.ori.found.cooperationRefused.message
            statusImage.setAttribute('src', 'images/icons/512x512/normal.png')
          }
        }

        if (restrictionsFound && disseminatorUrl) {
          if (cooperationRefused === false) {
            statusImage.setAttribute(
              'src',
              'images/icons/512x512/ori_blocked.png',
            )
          }
        }
        if (isOnionUrl(currentUrl)) {
          torNetwork.hidden = false
          toggleSiteActionsButton.hidden = true
          restrictionsInfoBlock.classList.add('hidden')
          disseminatorInfoBlock.classList.add('hidden')
          statusImage.setAttribute('src', 'images/icons/512x512/tor.png')
        } else if (isI2PUrl(currentUrl)) {
          i2pNetwork.hidden = false
          toggleSiteActionsButton.hidden = true
          restrictionsInfoBlock.classList.add('hidden')
          disseminatorInfoBlock.classList.add('hidden')
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

  Browser.storage.local
    .get('backendIsIntermittent')
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

  const showWhatThisMeanButtons = () => {
    whatThisMeanButtons.forEach((btn) => {
      btn.style.display = 'flex'
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

  setTimeout(show, 100)
})()
