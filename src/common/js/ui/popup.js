import {
  extractHostnameFromUrl,
  isExtensionUrl,
  proxy,
  registry,
  select,
  settings,
  storage,
  translateDocument,
} from '..'

(async () => {
  translateDocument(document)
  const thisIsFirefox = settings.isFirefox
  const currentBrowser = settings.getBrowser()
  const uiText = {
    ori: {
      found: {
        title: currentBrowser.i18n.getMessage('distrTitle'),
        statusIcon: 'images/icons/status/icon_danger.svg',
        detailsText: currentBrowser.i18n.getMessage('distrDesc'),
        detailsClasses: ['text-warning'],
        cooperationRefused: {
          message: currentBrowser.i18n.getMessage('distrCoopRefused'),

        },
      },
      notFound: {
        statusIcon: 'images/icons/status/icon_ok.svg',
        title: currentBrowser.i18n.getMessage('notDistrTitle'),
        detailsText: currentBrowser.i18n.getMessage('notDistrDesc'),
      },
    },
    restrictions: {
      true: {
        statusIcon: 'images/icons/status/icon_info.svg',
        title: currentBrowser.i18n.getMessage('blockedTitle'),
        detailsText: currentBrowser.i18n.getMessage('blockedDesc'),
      },
      false: {
        statusIcon: 'images/icons/status/icon_ok.svg',
        title: currentBrowser.i18n.getMessage('notBlockedTitle'),
        detailsText: currentBrowser.i18n.getMessage('notBlockedDesc'),
      },
    },
  }
  const statusImage = select({ id: 'statusImage' })
  const oriSiteInfo = select({ id: 'oriSiteInfo' })
  const textAboutOri = select({ id: 'textAboutOri' })
  const detailsText = select({ query: '.details-text' })
  const extensionIsOff = select({ id: 'extensionIsOff' })
  const restrictionType = select({ id: 'restrictionType' })
  const mainPageInfoBlocks = select({ query: '.main-page-info' })
  const currentDomainBlocks = select({ query: '.current-domain' })
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
    window.location.href = 'incognito_required_popup.html'
  })

  controlledByOtherExtensionsButton.addEventListener('click', () => {
    window.location.href = 'controlled.html'
  })

  const proxyIsAlive = await proxy.alive()
  const proxyingEnabled = await proxy.enabled()

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

  const proxyControlledByOtherExtensions = await proxy.controlledByOtherExtensions()

  if (!thisIsFirefox && proxyControlledByOtherExtensions) {
    controlledByOtherExtensionsButton.hidden = false
  }

  const { countryDetails: { isoA2Code } = {} } = await registry.getConfig()

  if (isoA2Code !== 'RU') {
    document.getElementById('ori').hidden = true
  }

  const changeStatusImage = (imageName) => {
    const imageSrc = currentBrowser.runtime.getURL(`images/icons/512x512/${imageName}.png`)

    statusImage.setAttribute('src', imageSrc)
  }

  document.addEventListener('click', async (event) => {
    if (event.target.matches('#enableExtension')) {
      await settings.enableExtension()
      window.location.reload()
    }

    if (event.target.matches('#disableExtension')) {
      await settings.disableExtension()
      mainPageInfoBlocks.forEach((element) => {
        element.hidden = true
      })
      window.location.reload()
    }

    if (event.target.matches('#openOptionsPage')) {
      await currentBrowser.runtime.openOptionsPage()
    }
  })

  const extensionEnabled = await settings.extensionEnabled()

  if (extensionEnabled && thisIsFirefox) {
    const allowedIncognitoAccess = await currentBrowser.extension.isAllowedIncognitoAccess()
    const { privateBrowsingPermissionsRequired } = await storage.get({
      privateBrowsingPermissionsRequired: false,
    })

    if (!allowedIncognitoAccess || privateBrowsingPermissionsRequired) {
      privateBrowsingPermissionsRequiredButton.hidden = false
    }
  }

  const [{ url: currentUrl }] = await currentBrowser.tabs.query({
    active: true, lastFocusedWindow: true,
  })

  const currentHostname = extractHostnameFromUrl(currentUrl)

  currentDomainBlocks.forEach((element) => {
    if (isExtensionUrl(currentUrl)) {
      const popupNewTabMessage = currentBrowser.i18n.getMessage('popupNewTabMessage')

      element.innerText = popupNewTabMessage

      if (popupNewTabMessage.length >= 25) {
        element.style.fontSize = '15px'
      }
    } else {
      element.innerText = currentHostname
    }
  })

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

    const restrictionsFound = await registry.contains(currentHostname)

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

    const { url: distributorUrl, cooperationRefused } =
      await registry.retrieveInformationDisseminationOrganizerJSON(currentHostname)

    if (distributorUrl) {
      currentDomainHeader.classList.add('title-ori')

      if (cooperationRefused) {
        oriSiteInfo.innerText = uiText.ori.found.cooperationRefused.message
        textAboutOri.classList.remove('text-warning')
        textAboutOri.classList.add('text-normal')
        currentDomainHeader.classList.remove('title-ori')
        currentDomainHeader.classList.add('title-normal')
      } else {
        changeStatusImage('ori')
        select({ query: '#ori [data-render-var]' }).forEach((element) => {
          const renderVar = element.dataset.renderVar
          const value = uiText.ori.found[renderVar]

          if (renderVar === 'statusIcon') {
            element.setAttribute('src', value)
          } else if (renderVar === 'detailsClasses') {
            element.classList.add(uiText.ori.found.detailsClasses)
          } else {
            element.innerText = value
          }
        })
      }
    }

    if (restrictionsFound && distributorUrl) {
      if (cooperationRefused === false) {
        changeStatusImage('ori_blocked')
      }
    }

    const { restriction } = await registry.getCustomRegistryRecordByURL(currentHostname)

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

      restrictionType.innerText = currentBrowser.i18n.getMessage(titlePlaceholder)
      restrictionDescription.innerText = currentBrowser.i18n.getMessage(descriptionPlaceholder)
    }
  } else {
    changeStatusImage('disabled')
    extensionIsOff.hidden = false
    mainPageInfoBlocks.forEach((element) => {
      element.hidden = true
    })
  }

  for (const button of whatThisMeanButtons) {
    button.addEventListener('click', () => {
      detailsText.forEach((element) => {
        element.style.display = 'none'
      })

      button.style.display = 'none'
      button.nextElementSibling.style.display = 'block'
    })
  }

  for (const closeButton of closeDetailsButtons) {
    closeButton.addEventListener('click', () => {
      detailsText.forEach((block) => {
        block.style.display = 'none'
      })

      whatThisMeanButtons.forEach((button) => {
        button.style.display = 'flex'
      })
    })
  }

  const show = () => {
    document.documentElement.style.visibility = 'initial'
  }

  setTimeout(show, 100)
})()
