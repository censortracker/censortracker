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
const mainPageInfoBlocks = querySelectorAll('.main-page-info')
const controlledOtherExtensionsInfo = document.getElementById('controlledOtherExtensionsInfo')
const popupShowTimeout = 60

controlledOtherExtensionsInfo.addEventListener('click', () => {
  window.location.href = 'controlled.html'
})

chrome.runtime.getBackgroundPage(async ({ censortracker: bgModules }) => {
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

  const { asynchrome, registry, proxy, storage } = bgModules

  await addExtensionControlListeners(bgModules)

  const { enableExtension } = await storage.get({ enableExtension: true })

  const [{ url: currentURL }] = await asynchrome.tabs.query({
    active: true, lastFocusedWindow: true,
  })

  const { hostname } = getAppropriateURL(currentURL)
  const currentHostname = bgModules.extractHostnameFromUrl(hostname)

  currentDomainBlocks.forEach((element) => {
    element.innerText = currentHostname
  })

  const { restriction } = await bgModules.registry.getUnregisteredRecordByURL(currentHostname)

  if (restriction && restriction.name) {
    restrictionType.innerText = restriction.name
    restrictionDescription.innerText = restriction.description
  }

  if (enableExtension) {
    changeStatusImage('normal')

    if (currentHostname.length >= 22 && currentHostname.length < 25) {
      currentDomainHeader.style.fontSize = '17px'
    } else if (currentHostname.length >= 25) {
      currentDomainHeader.style.fontSize = '15px'
    }
    currentDomainHeader.classList.add('title-normal')
    currentDomainHeader.removeAttribute('hidden')

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
        console.warn('Cooperation accepted!')
      }
    } else {
      console.log('Match not found at all')
    }

    if (urlBlocked && distributorUrl) {
      if (cooperationRefused === false) {
        changeStatusImage('ori_blocked')
      }
    }
  } else {
    hideControlElements()
  }

  const isProxyControlledByOtherExtensions = await proxy.controlledByOtherExtensions()

  if (isProxyControlledByOtherExtensions) {
    controlledOtherExtensionsInfo.hidden = false
  }

  const show = () => {
    document.documentElement.style.visibility = 'initial'
  }

  setTimeout(show, popupShowTimeout)
})

const addExtensionControlListeners = async ({ settings }) => {
  document.addEventListener('click', (event) => {
    if (event.target.matches('#enableExtension')) {
      settings.enableExtension()
      window.location.reload()
    }

    if (event.target.matches('#disableExtension')) {
      settings.disableExtension()
      mainPageInfoBlocks.forEach((element) => {
        element.hidden = true
      })
      window.location.reload()
    }

    if (event.target.matches('#openOptionsPage')) {
      chrome.runtime.openOptionsPage()
    }
  })
}

const changeStatusImage = (imageName) => {
  const imageSrc = chrome.runtime.getURL(`images/icons/512x512/${imageName}.png`)

  statusImage.setAttribute('src', imageSrc)
}

const getAppropriateURL = (currentURL) => {
  const popupURL = chrome.runtime.getURL('popup.html')

  if (currentURL.startsWith(popupURL)) {
    const currentURLParams = currentURL.split('?')[1]
    const searchParams = new URLSearchParams(currentURLParams)
    const encodedURL = searchParams.get('loadFor')
    const loadForURL = window.atob(encodedURL)

    return new URL(loadForURL)
  }
  return new URL(currentURL)
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
