import { extractHostnameFromUrl, registry, settings, storage } from '../../../common/js'

(async () => {
  const getElementById = (id) => document.getElementById(id)
  const querySelectorAll = (selector) => document.querySelectorAll(selector)

  const statusImage = getElementById('statusImage')
  const currentDomainHeader = getElementById('currentDomainHeader')
  const footerTrackerOff = getElementById('footerTrackerOff')
  const trackerOff = getElementById('trackerOff')
  const footerTrackerOn = getElementById('footerTrackerOn')
  const textAboutOri = getElementById('textAboutOri')
  const oriSiteInfo = getElementById('oriSiteInfo')
  const restrictionDescription = getElementById('restriction-description')
  const restrictionType = getElementById('restriction-type')
  const currentDomainBlocks = document.querySelectorAll('.current-domain')
  const detailBlocks = document.querySelectorAll('.details-block')
  const closeDetailsButtons = document.querySelectorAll('.btn-hide-details')
  const whatThisMeanButtons = document.querySelectorAll('.btn-what-this-mean')
  const privateBrowsingPermissionsRequiredButton = getElementById('privateBrowsingPermissionsRequiredButton')

  const popupShowTimeout = 60

  const uiConfig = {
    ori: {
      found: {
        title: 'Является организатором распространения информации',
        statusIcon: 'images/icons/status/icon_danger.svg',
        detailsText: 'Сервис может передавать ваши личные данные, в том числе сообщения и весь трафик, ' +
          'российским государственным органам в автоматическом режиме.',
        detailsClasses: ['text-warning'],
      },
      notFound: {
        title: 'Не является организатором распространения информации',
        statusIcon: 'images/icons/status/icon_ok.svg',
        detailsText: 'Сервисы из реестра ОРИ могут передавать ваши личные данные, в т.ч. сообщения и весь трафик, ' +
          'государственным органам в автоматическом режиме. Этот сервис не находится в реестре ОРИ.',
      },
    },
    restrictions: {
      found: {
        title: 'Запрещён в России',
        statusIcon: 'images/icons/status/icon_info.svg',
        detailsText: 'Доступ к сайту запрещён, но Censor Tracker даёт к нему доступ через надёжный прокси.',
      },
      notFound: {
        title: 'Не запрещён в России',
        statusIcon: 'images/icons/status/icon_ok.svg',
        detailsText: 'Если доступ к сайту запретят, то Censor Tracker предложит открыть сайт через надёжный прокси.',
      },
    },
  }

  privateBrowsingPermissionsRequiredButton.addEventListener('click', () => {
    window.location.href = 'additional_permissions_required.html'
  })

  const changeStatusImage = (imageName) => {
    const imageSrc = browser.runtime.getURL(`images/icons/512x512/${imageName}.png`)

    statusImage.setAttribute('src', imageSrc)
  }

  const getAppropriateUrl = (currentUrl) => {
    const popupUrl = browser.runtime.getURL('popup.html')

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
  }

  document.addEventListener('click', async (event) => {
    if (event.target.matches('#enableExtension')) {
      await settings.enableExtension()
      window.location.reload()
    }

    if (event.target.matches('#disableExtension')) {
      await settings.disableExtension()
      window.location.reload()
    }

    if (event.target.matches('#openOptionsPage')) {
      await browser.runtime.openOptionsPage()
    }
  })

  const allowedIncognitoAccess = await browser.extension.isAllowedIncognitoAccess()
  const { privateBrowsingPermissionsRequired } = await storage.get({
    privateBrowsingPermissionsRequired: false,
  })

  const extensionEnabled = await settings.extensionEnabled()

  if (extensionEnabled) {
    if (!allowedIncognitoAccess || privateBrowsingPermissionsRequired) {
      privateBrowsingPermissionsRequiredButton.hidden = false
    }
  }

  const [{ url: currentUrl }] = await browser.tabs.query({
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
      const elements = querySelectorAll('#restrictions [data-render-var]')

      for (const element of elements) {
        const renderVar = element.dataset.renderVar
        const value = uiConfig.restrictions.found[renderVar]

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

  setTimeout(show, popupShowTimeout)

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
