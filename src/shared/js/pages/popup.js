import ProxyManager from 'Background/proxy'
import Registry from 'Background/registry'
import Settings from 'Background/settings'
import * as storage from 'Background/storage'
import {
  extractHostnameFromUrl,
  isValidURL,
  select,
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
  const statusImage = select({ id: 'statusImage' })
  const detailsText = select({ query: '.details-text' })
  const extensionIsOff = select({ id: 'extensionIsOff' })
  const restrictionType = select({ id: 'restrictionType' })
  const mainPageInfoBlocks = select({ query: '.main-page-info' })
  const popupProxyStatusOk = select({ id: 'popupProxyStatusOk' })
  const popupProxyDisabled = select({ id: 'popupProxyDisabled' })
  const popupProxyStatusError = select({ id: 'popupProxyStatusError' })
  const footerExtensionIsOn = select({ id: 'footerExtensionIsOn' })
  const currentDomainHeader = select({ id: 'currentDomainHeader' })
  const closeDetailsButtons = select({ query: '.btn-hide-details' })
  const whatThisMeanButtons = select({ query: '.btn-what-this-mean' })
  const restrictionDescription = select({ id: 'restrictionDescription' })
  const controlledByOtherExtensionsButton = select({ id: 'controlledByOtherExtensionsButton' })
  const privateBrowsingPermissionsRequiredButton = select({ id: 'privateBrowsingPermissionsRequiredButton' })

  privateBrowsingPermissionsRequiredButton.addEventListener('click', () => {
    window.location.href = 'incognito-required-popup.html'
  })

  controlledByOtherExtensionsButton.addEventListener('click', () => {
    window.location.href = 'controlled.html'
  })

  const proxyIsAlive = await ProxyManager.alive()
  const proxyingEnabled = await ProxyManager.isEnabled()

  if (proxyingEnabled) {
    if (proxyIsAlive) {
      popupProxyStatusOk.hidden = false
      popupProxyStatusError.hidden = true
    } else {
      popupProxyStatusOk.hidden = true
      popupProxyStatusError.hidden = false
    }
  } else {
    popupProxyDisabled.hidden = false
  }

  const proxyControlledByOtherExtensions = await ProxyManager.controlledByOtherExtensions()

  if (!Browser.IS_FIREFOX && proxyControlledByOtherExtensions) {
    controlledByOtherExtensionsButton.hidden = false
  }

  const { countryDetails: { isoA2Code } = {} } = await Registry.getConfig()

  if (isoA2Code !== 'RU') {
    document.getElementById('ori').hidden = true
  }

  const changeStatusImage = (imageName) => {
    const imageSrc = Browser.runtime.getURL(`images/icons/512x512/${imageName}.png`)

    statusImage.setAttribute('src', imageSrc)
  }

  document.addEventListener('click', async (event) => {
    if (event.target.matches('#enableExtension')) {
      await Settings.enableExtension()
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

  const extensionEnabled = await Settings.extensionEnabled()

  if (extensionEnabled && Browser.IS_FIREFOX) {
    const allowedIncognitoAccess = await Browser.extension.isAllowedIncognitoAccess()
    const { privateBrowsingPermissionsRequired } = await storage.get({
      privateBrowsingPermissionsRequired: false,
    })

    if (!allowedIncognitoAccess || privateBrowsingPermissionsRequired) {
      privateBrowsingPermissionsRequiredButton.hidden = false
    }
  }

  const [{ url: currentUrl }] = await Browser.tabs.query({
    active: true, lastFocusedWindow: true,
  })

  const currentHostname = extractHostnameFromUrl(currentUrl)

  console.warn(`Current hostname: ${currentHostname}`)

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

    select({ query: '#restrictions [data-render-var]' }).forEach((el) => {
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

        for (const element of select({ query: '#ori [data-render-var]' })) {
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
        const [disseminatorDetailsText] = select({ query: '#ori [data-render-var="detailsText"]' })

        disseminatorDetailsText.innerText = uiText.ori.found.cooperationRefused.message

        changeStatusImage('normal')
      }
    }

    if (restrictionsFound && disseminatorUrl) {
      if (cooperationRefused === false) {
        changeStatusImage('ori_blocked')
      }
    }

    const { restriction } = await Registry.getCustomRegistryRecordByURL(currentHostname)

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
