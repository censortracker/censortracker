const getElementById = (id) => document.getElementById(id)

const statusImage = getElementById('statusImage')
const currentDomainHeader = getElementById('currentDomainHeader')
const footerTrackerOff = getElementById('footerTrackerOff')
const trackerOff = getElementById('trackerOff')
const isOriBlock = getElementById('isOriBlock')
const isNotOriBlock = getElementById('isNotOriBlock')
const restrictionsApplied = getElementById('restrictionsApplied')
const restrictionsAreNotApplied = getElementById('restrictionsAreNotApplied')
const footerTrackerOn = getElementById('footerTrackerOn')
const aboutOriButton = getElementById('aboutOriButton')
const textAboutOri = getElementById('textAboutOri')
const closeTextAboutOri = getElementById('closeTextAboutOri')
const btnRestrictionsInfo = getElementById('btnRestrictionsInfo')
const textAboutForbidden = getElementById('textAboutForbidden')
const closeTextAboutForbidden = getElementById('closeTextAboutForbidden')
const btnAboutNotForbidden = getElementById('btnAboutNotForbidden')
const textAboutNotForbidden = getElementById('textAboutNotForbidden')
const closeTextAboutNotForbidden = getElementById('closeTextAboutNotForbidden')
const btnAboutNotOri = getElementById('btnAboutNotOri')
const textAboutNotOri = getElementById('textAboutNotOri')
const closeTextAboutNotOri = getElementById('closeTextAboutNotOri')
const oriSiteInfo = getElementById('oriSiteInfo')
const currentDomainBlocks = document.querySelectorAll('.current-domain')
const restrictionDescription = getElementById('restriction-description')
const restrictionType = getElementById('restriction-type')
const controlledOtherExtensionsInfo = document.getElementById('controlledOtherExtensionsInfo')
const popupShowTimeout = 60

controlledOtherExtensionsInfo.addEventListener('click', () => {
  window.location.href = 'controlled.html'
})

chrome.runtime.getBackgroundPage(async ({ censortracker: bgModules }) => {
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
    renderCurrentDomain(currentHostname)
    footerTrackerOn.removeAttribute('hidden')

    const { domainFound } = await registry.domainsContains(currentHostname)

    if (domainFound) {
      changeStatusImage('blocked')
      restrictionsApplied.removeAttribute('hidden')
      restrictionsAreNotApplied.remove()
    } else {
      restrictionsAreNotApplied.removeAttribute('hidden')
      restrictionsApplied.remove()
      changeStatusImage('normal')
    }

    const { url: distributorUrl, cooperationRefused } =
      await registry.distributorsContains(currentHostname)

    if (distributorUrl) {
      currentDomainHeader.classList.add('title-ori')
      isOriBlock.removeAttribute('hidden')
      isNotOriBlock.remove()

      if (cooperationRefused) {
        showCooperationRefusedMessage()
      } else {
        changeStatusImage('ori')
        console.warn('Cooperation accepted!')
      }
    } else {
      isNotOriBlock.removeAttribute('hidden')
      isOriBlock.remove()
      console.log('Match not found at all')
    }

    if (domainFound && distributorUrl) {
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

const addExtensionControlListeners = async ({ settings, proxy, webRequestListeners }) => {
  document.addEventListener('click', (event) => {
    if (event.target.matches('#enableExtension')) {
      settings.enableExtension()
      proxy.setProxy()
      webRequestListeners.activate()
      window.location.reload()
    }

    if (event.target.matches('#disableExtension')) {
      proxy.removeProxy()
      settings.disableExtension()
      webRequestListeners.deactivate()
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
  isOriBlock.hidden = true
  restrictionsApplied.hidden = true
  isNotOriBlock.hidden = true
  restrictionsAreNotApplied.hidden = true
}

aboutOriButton.addEventListener('click', () => {
  textAboutOri.style.display = 'block'
  aboutOriButton.style.display = 'none'
  hideForbiddenDetails()
})

btnAboutNotOri.addEventListener('click', () => {
  textAboutNotOri.style.display = 'block'
  btnAboutNotOri.style.display = 'none'
  hideForbiddenDetails()
})

closeTextAboutNotOri.addEventListener('click', () => {
  textAboutNotOri.style.display = 'none'
  btnAboutNotOri.style.display = 'flex'
},
)

closeTextAboutOri.addEventListener('click', () => {
  textAboutOri.style.display = 'none'
  aboutOriButton.style.display = 'flex'
},
)

btnRestrictionsInfo.addEventListener('click', () => {
  textAboutForbidden.style.display = 'block'
  btnRestrictionsInfo.style.display = 'none'
  hideOriDetails()
},
)

btnAboutNotForbidden.addEventListener('click', () => {
  textAboutNotForbidden.style.display = 'block'
  btnAboutNotForbidden.style.display = 'none'
  hideOriDetails()
})

closeTextAboutForbidden.addEventListener('click', () => {
  textAboutForbidden.style.display = 'none'
  btnRestrictionsInfo.style.display = 'flex'
},
)

closeTextAboutNotForbidden.addEventListener('click', () => {
  textAboutNotForbidden.style.display = 'none'
  btnAboutNotForbidden.style.display = 'flex'
})

const hideOriDetails = () => {
  textAboutOri.style.display = 'none'
  aboutOriButton.style.display = 'flex'
  textAboutNotOri.style.display = 'none'
  btnAboutNotOri.style.display = 'flex'
}

const hideForbiddenDetails = () => {
  textAboutForbidden.style.display = 'none'
  btnRestrictionsInfo.style.display = 'flex'
  textAboutNotForbidden.style.display = 'none'
  btnAboutNotForbidden.style.display = 'flex'
}
