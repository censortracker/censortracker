import { extractHostnameFromUrl, proxy, registry, settings, storage } from '..'
import { getUIText, select } from './ui'

(async () => {
  const showTimeout = 50
  const thisIsFirefox = settings.isFirefox
  const currentBrowser = settings.getBrowser()

  const statusImage = select({ id: 'statusImage' })
  const currentDomainHeader = select({ id: 'currentDomainHeader' })
  const footerTrackerOff = select({ id: 'footerTrackerOff' })
  const trackerOff = select({ id: 'trackerOff' })
  const footerTrackerOn = select({ id: 'footerTrackerOn' })
  const textAboutOri = select({ id: 'textAboutOri' })
  const oriSiteInfo = select({ id: 'oriSiteInfo' })

  // TODO: Add these elements back to popup.html
  const restrictionType = select({ id: 'restriction-type' })
  const restrictionDescription = select({ id: 'restriction-description' })

  // Using only in Chromium
  const controlledOtherExtensionsInfo = select({ id: 'controlledOtherExtensionsInfo' })
  // Using only in Firefox
  const privateBrowsingPermissionsRequiredButton = select({ id: 'privateBrowsingPermissionsRequiredButton' })

  const detailBlocks = select({ query: '.details-block' })
  const mainPageInfoBlocks = select({ query: '.main-page-info' })
  const currentDomainBlocks = select({ query: '.current-domain' })
  const closeDetailsButtons = select({ query: '.btn-hide-details' })
  const whatThisMeanButtons = select({ query: '.btn-what-this-mean' })

  // Firefox Only
  privateBrowsingPermissionsRequiredButton.addEventListener('click', () => {
    window.location.href = 'additional_permissions_required.html'
  })

  // Chromium Only
  controlledOtherExtensionsInfo.addEventListener('click', () => {
    window.location.href = 'controlled.html'
  })

  const proxyControlledByOtherExtensions = await proxy.controlledByOtherExtensions()

  if (!thisIsFirefox && proxyControlledByOtherExtensions) {
    controlledOtherExtensionsInfo.hidden = false
  }

  const changeStatusImage = (imageName) => {
    const imageSrc = currentBrowser.runtime.getURL(`images/icons/512x512/${imageName}.png`)

    statusImage.setAttribute('src', imageSrc)
  }

  const getAppropriateUrl = (currentUrl) => {
    const popupUrl = currentBrowser.runtime.getURL('popup.html')

    if (currentUrl.startsWith(popupUrl)) {
      const currentURLParams = currentUrl.split('?')[1]
      const searchParams = new URLSearchParams(currentURLParams)
      const encodedUrl = searchParams.get('loadFor')

      return window.atob(encodedUrl)
    }
    return currentUrl
  }

  const renderCurrentDomain = ({ length }) => {
    if (length >= 22 && length < 25) {
      currentDomainHeader.style.fontSize = '17px'
    } else if (length >= 25) {
      currentDomainHeader.style.fontSize = '15px'
    }
    currentDomainHeader.classList.add('title-normal')
    currentDomainHeader.removeAttribute('hidden')
  }

  const showCooperationRefusedMessage = () => {
    oriSiteInfo.innerText = 'Сервис заявил, что они не передают трафик российским ' +
      'государственным органам в автоматическом режиме.'
    textAboutOri.classList.remove('text-warning')
    textAboutOri.classList.add('text-normal')
    currentDomainHeader.classList.remove('title-ori')
    currentDomainHeader.classList.add('title-normal')
  }

  const hideControlElements = () => {
    changeStatusImage('disabled')
    trackerOff.hidden = false
    footerTrackerOff.hidden = false
    mainPageInfoBlocks.forEach((element) => {
      element.hidden = true
    })
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

  const currentHostname = extractHostnameFromUrl(
    getAppropriateUrl(currentUrl),
  )

  currentDomainBlocks.forEach((element) => {
    element.innerText = currentHostname
  })

  const { restriction } = await registry.getUnregisteredRecordByURL(currentHostname)

  if (restriction && restriction.name) {
    restrictionType.innerText = restriction.name
    restrictionDescription.innerText = restriction.description
  }

  if (extensionEnabled) {
    changeStatusImage('normal')
    renderCurrentDomain(currentHostname)
    footerTrackerOn.removeAttribute('hidden')

    const urlBlocked = await registry.contains(currentHostname)

    if (urlBlocked) {
      changeStatusImage('blocked')
      const elements = select({ query: '#restrictions [data-render-var]' })

      for (const element of elements) {
        const renderVar = element.dataset.renderVar
        const value = getUIText().restrictions.found[renderVar]

        if (renderVar === 'statusIcon') {
          element.setAttribute('src', value)
        } else {
          element.innerText = value
        }
      }
    }

    const { url: distributorUrl, cooperationRefused } =
      await registry.distributorsContains(currentHostname)

    if (distributorUrl) {
      currentDomainHeader.classList.add('title-ori')

      if (cooperationRefused) {
        showCooperationRefusedMessage()
      } else {
        changeStatusImage('ori')
        const elements = select({ query: '#ori [data-render-var]' })

        for (const element of elements) {
          const renderVar = element.dataset.renderVar
          const value = getUIText().ori.found[renderVar]

          if (renderVar === 'statusIcon') {
            element.setAttribute('src', value)
          } else if (renderVar === 'detailsClasses') {
            element.classList.add(getUIText().ori.found.detailsClasses)
          } else {
            element.innerText = value
          }
        }
      }
    }

    if (urlBlocked && distributorUrl) {
      if (cooperationRefused === false) {
        changeStatusImage('ori_blocked')
      }
    }
  } else {
    hideControlElements()
  }

  const show = () => {
    document.documentElement.style.visibility = 'initial'
  }

  setTimeout(show, showTimeout)

  whatThisMeanButtons.forEach((button) => {
    button.addEventListener('click', () => {
      detailBlocks.forEach((element) => {
        element.style.display = 'none'
      })

      button.style.display = 'none'
      button.nextSibling.style.display = 'block'
    })
  })

  closeDetailsButtons.forEach((closeButton) =>
    closeButton.addEventListener('click', () => {
      detailBlocks.forEach((block) => {
        block.style.display = 'none'
      })

      whatThisMeanButtons.forEach((button) => {
        button.style.display = 'flex'
      })
    }),
  )
})()
