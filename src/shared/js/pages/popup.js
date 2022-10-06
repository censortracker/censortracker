import Ignore from 'Background/ignore'
import ProxyManager from 'Background/proxy'
import Registry from 'Background/registry'
import Settings from 'Background/settings'
import * as storage from 'Background/storage'
import {
  extractHostnameFromUrl,
  isValidURL,
} from 'Background/utilities'
import Browser from 'Background/webextension';

(async () => {
  const uiText = {
    ori: {
      found: {
        title: Browser.i18n.getMessage('disseminatorTitle'),
        statusIcon: 'images/popup/status/danger.svg',
        detailsText: Browser.i18n.getMessage('disseminatorDesc'),
        detailsClasses: ['text-warning'],
        cooperationRefused: {
          message: Browser.i18n.getMessage('disseminatorCoopRefused'),
        },
      },
      notFound: {
        statusIcon: 'images/popup/status/ok.svg',
        title: Browser.i18n.getMessage('notDisseminatorTitle'),
        detailsText: Browser.i18n.getMessage('notDisseminatorDesc'),
      },
    },
    restrictions: {
      true: {
        statusIcon: 'images/popup/status/info.svg',
        title: Browser.i18n.getMessage('blockedTitle'),
        detailsText: Browser.i18n.getMessage('blockedDesc'),
      },
      false: {
        statusIcon: 'images/popup/status/ok.svg',
        title: Browser.i18n.getMessage('notBlockedTitle'),
        detailsText: Browser.i18n.getMessage('notBlockedDesc'),
      },
    },
  }
  const statusImage = document.getElementById('statusImage')
  const detailsText = document.querySelectorAll('.details-text')
  const extensionIsOff = document.getElementById('extensionIsOff')
  const restrictionType = document.getElementById('restrictionType')
  const mainPageInfoBlocks = document.querySelectorAll('.main-page-info')
  const popupProxyStatusOk = document.getElementById('popupProxyStatusOk')
  const popupProxyDisabled = document.getElementById('popupProxyDisabled')
  const popupProxyStatusError = document.getElementById('popupProxyStatusError')
  const popupBackedStatusError = document.getElementById('popupBackedStatusError')
  const footerExtensionIsOn = document.getElementById('footerExtensionIsOn')
  const currentDomainHeader = document.getElementById('currentDomainHeader')
  const closeDetailsButtons = document.querySelectorAll('.btn-hide-details')
  const whatThisMeanButtons = document.querySelectorAll('.btn-what-this-mean')
  const restrictionDescription = document.getElementById('restrictionDescription')
  const controlledByOtherExtensionsButton = document.getElementById('controlledByOtherExtensionsButton')
  const privateBrowsingPermissionsRequiredButton = document.getElementById('privateBrowsingPermissionsRequiredButton')
  const siteActions = document.getElementById('siteActions')
  const siteActionAuto = document.getElementById('siteActionAuto')
  const siteActionProxy = document.getElementById('siteActionProxy')
  const siteActionIgnore = document.getElementById('siteActionIgnore')
  const toggleSiteActionsButton = document.getElementById('toggleSiteActions')

  const [{ url: currentUrl }] = await Browser.tabs.query({
    active: true, lastFocusedWindow: true,
  })
  const currentHostname = extractHostnameFromUrl(currentUrl)

  // Show website actions only for valid URLs
  if (isValidURL(currentUrl)) {
    toggleSiteActionsButton.classList.remove('hidden')
    toggleSiteActionsButton.addEventListener('click', async (event) => {
      Registry.contains(currentHostname)
        .then((blocked) => {
          siteActionProxy.checked = blocked
        })

      Ignore.contains(currentHostname)
        .then((ignored) => {
          if (ignored) {
            siteActionIgnore.checked = ignored
          }
        })

      if (event.target.classList.contains('icon-show')) {
        siteActions.classList.remove('hidden')
        event.target.classList.remove('icon-show')
        event.target.classList.add('icon-hide')
      } else {
        siteActions.classList.add('hidden')
        event.target.classList.add('icon-show')
        event.target.classList.remove('icon-hide')
      }
    })

    siteActionAuto.addEventListener('click', async (event) => {
      await Ignore.remove(currentUrl)
    })

    siteActionProxy.addEventListener('click', async (event) => {
      if (event.target.checked) {
        await Registry.add(currentUrl)
      } else {
        await Registry.remove(currentUrl)
      }
    })

    siteActionIgnore.addEventListener('click', async (event) => {
      if (event.target.checked) {
        await Ignore.add(currentUrl)
      } else {
        await Ignore.remove(currentUrl)
      }
    })
  }

  privateBrowsingPermissionsRequiredButton.addEventListener('click', () => {
    window.location.href = 'incognito-required-popup.html'
  })

  controlledByOtherExtensionsButton.addEventListener('click', () => {
    window.location.href = 'controlled.html'
  })

  const proxyingEnabled = await ProxyManager.isEnabled()
  const extensionEnabled = await Settings.extensionEnabled()

  storage.get('backendIsIntermittent')
    .then(({ backendIsIntermittent = false }) => {
      popupBackedStatusError.hidden = !backendIsIntermittent
    })

  ProxyManager.alive().then((alive) => {
    if (proxyingEnabled) {
      if (alive) {
        popupProxyStatusOk.hidden = false
        popupProxyStatusError.hidden = true
      } else {
        popupProxyStatusOk.hidden = true
        popupProxyStatusError.hidden = false
      }
    } else {
      popupProxyDisabled.hidden = false
    }
  })

  ProxyManager.controlledByOtherExtensions()
    .then((controlledByOtherExtensions) => {
      if (!Browser.IS_FIREFOX && controlledByOtherExtensions) {
        controlledByOtherExtensionsButton.hidden = false
      }
    })

  const changeStatusImage = (imageName) => {
    const imageSrc = Browser.runtime.getURL(`images/icons/512x512/${imageName}.png`)

    statusImage.setAttribute('src', imageSrc)
  }

  document.addEventListener('click', async (event) => {
    if (event.target.matches('#enableExtension')) {
      await Settings.enableExtension()
      await Settings.enableNotifications()
      await ProxyManager.enableProxy()
      window.location.reload()
    }

    if (event.target.matches('#disableExtension')) {
      await Settings.disableExtension()
      mainPageInfoBlocks.forEach((element) => {
        element.hidden = true
      })
      window.location.reload()
    }

    if (event.target.matches('#openOptionsPage')) {
      await Browser.runtime.openOptionsPage()
    }
  })

  if (extensionEnabled && Browser.IS_FIREFOX) {
    Browser.extension.isAllowedIncognitoAccess()
      .then((allowedIncognitoAccess) => {
        storage.get({ privateBrowsingPermissionsRequired: false })
          .then(({ privateBrowsingPermissionsRequired }) => {
            if (!allowedIncognitoAccess || privateBrowsingPermissionsRequired) {
              privateBrowsingPermissionsRequiredButton.hidden = false
            }
          })
      })
  }

  if (isValidURL(currentHostname)) {
    currentDomainHeader.innerText = currentHostname
  } else {
    const popupNewTabMessage = Browser.i18n.getMessage('popupNewTabMessage')

    currentDomainHeader.innerText = popupNewTabMessage

    if (popupNewTabMessage.length >= 25) {
      currentDomainHeader.style.fontSize = '15px'
    }
  }

  if (extensionEnabled) {
    changeStatusImage('normal')

    if (currentHostname.length >= 22 && currentHostname.length < 25) {
      currentDomainHeader.style.fontSize = '17px'
    } else if (currentHostname.length >= 25) {
      currentDomainHeader.style.fontSize = '15px'
    }
    currentDomainHeader.classList.add('title-normal')
    currentDomainHeader.removeAttribute('hidden')
    footerExtensionIsOn.removeAttribute('hidden')

    const restrictionsFound = await Registry.contains(currentHostname)

    document.querySelectorAll('#restrictions [data-render-var]').forEach((el) => {
      const renderVar = el.dataset.renderVar
      const value = uiText.restrictions[restrictionsFound][renderVar]

      if (restrictionsFound && proxyingEnabled) {
        changeStatusImage('blocked')
      }

      if (renderVar === 'statusIcon') {
        el.setAttribute('src', value)
      } else {
        el.innerText = value
      }
    })

    const { url: disseminatorUrl, cooperationRefused } =
      await Registry.retrieveInformationDisseminationOrganizerJSON(currentHostname)

    console.log(`Disseminator URL: ${disseminatorUrl}`)
    console.log(`Disseminator Cooperation Refused: ${cooperationRefused}`)

    if (disseminatorUrl) {
      if (!cooperationRefused) {
        changeStatusImage('ori')
        currentDomainHeader.classList.add('title-ori')

        for (const element of document.querySelectorAll('#ori [data-render-var]')) {
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
        const [disseminatorDetailsText] = document.querySelectorAll('#ori [data-render-var="detailsText"]')

        disseminatorDetailsText.innerText = uiText.ori.found.cooperationRefused.message

        changeStatusImage('normal')
      }
    }

    if (restrictionsFound && disseminatorUrl) {
      if (cooperationRefused === false) {
        changeStatusImage('ori_blocked')
      }
    }

    Registry.getCustomRegistryRecordByURL(currentHostname)
      .then(({ restriction }) => {
        if (restriction && restriction.code) {
          let titlePlaceholder, descriptionPlaceholder

          const isBanned = restriction.code === 'ban'
          const isShaped = restriction.code === 'shaping'

          if (isShaped) {
            titlePlaceholder = 'trafficShapingTitle'
            descriptionPlaceholder = 'trafficShapingDescription'
          } else if (isBanned) {
            titlePlaceholder = 'blockedTitle'
            descriptionPlaceholder = 'blockedDesc'
          }

          restrictionType.innerText = Browser.i18n.getMessage(titlePlaceholder)
          restrictionDescription.innerText = Browser.i18n.getMessage(descriptionPlaceholder)
        }
      })
  } else {
    changeStatusImage('disabled')
    extensionIsOff.hidden = false
    mainPageInfoBlocks.forEach((element) => {
      element.hidden = true
    })
  }

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
