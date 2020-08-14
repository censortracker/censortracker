const getElementById = (id) => document.getElementById(id)

const statusImage = getElementById('statusImage')
const currentDomainHeader = getElementById('currentDomainHeader')
const footerTrackerOff = getElementById('footerTrackerOff')
const trackerOff = getElementById('trackerOff')
const isOriBlock = getElementById('isOriBlock')
const isNotOriBlock = getElementById('isNotOriBlock')
const isForbidden = getElementById('isForbidden')
const isNotForbidden = getElementById('isNotForbidden')
const footerTrackerOn = getElementById('footerTrackerOn')
const aboutOriButton = getElementById('aboutOriButton')
const textAboutOri = getElementById('textAboutOri')
const closeTextAboutOri = getElementById('closeTextAboutOri')
const btnAboutForbidden = getElementById('btnAboutForbidden')
const textAboutForbidden = getElementById('textAboutForbidden')
const closeTextAboutForbidden = getElementById('closeTextAboutForbidden')
const btnAboutNotForbidden = getElementById('btnAboutNotForbidden')
const textAboutNotForbidden = getElementById('textAboutNotForbidden')
const closeTextAboutNotForbidden = getElementById('closeTextAboutNotForbidden')
const btnAboutNotOri = getElementById('btnAboutNotOri')
const textAboutNotOri = getElementById('textAboutNotOri')
const closeTextAboutNotOri = getElementById('closeTextAboutNotOri')
const oriSiteInfo = getElementById('oriSiteInfo')
const advertisingBlocks = document.querySelectorAll('.buy-vpn')
const currentDomainBlocks = document.querySelectorAll('.current-domain')
const popupShowTimeout = 60

chrome.runtime.getBackgroundPage(async ({ censortracker: bgModules }) => {
  const { asynchrome, registry, shortcuts } = bgModules

  await addExtensionControlListeners(bgModules)

  const { enableExtension } = await asynchrome.storage.local.get({
    enableExtension: true,
  })

  const [{ url: currentURL }] = await asynchrome.tabs.query({
    active: true, lastFocusedWindow: true,
  })

  const { hostname } = getAppropriateURL(currentURL)
  const currentHostname = shortcuts.cleanHostname(hostname)

  interpolateCurrentDomain(currentHostname)

  if (enableExtension) {
    changeStatusImage('normal')
    renderCurrentDomain(currentHostname)
    footerTrackerOn.removeAttribute('hidden')

    const { domainFound } = await registry.domainsContains(currentHostname)

    if (domainFound) {
      changeStatusImage('blocked')
      isForbidden.removeAttribute('hidden')
      isNotForbidden.remove()
      showAdvertising()
    } else {
      isNotForbidden.removeAttribute('hidden')
      isForbidden.remove()
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

  const show = () => {
    document.documentElement.style.visibility = 'initial'
  }

  setTimeout(show, popupShowTimeout)
})

const addExtensionControlListeners = async ({ settings, proxies }) => {
  document.addEventListener('click', (event) => {
    if (event.target.matches('#enableExtension')) {
      settings.enableExtension()
      proxies.setProxy()
      window.location.reload()
    }

    if (event.target.matches('#disableExtension')) {
      proxies.removeProxy()
      settings.disableExtension()
      window.location.reload()
    }
  })
}

const changeStatusImage = (imageName) => {
  const imageSrc = chrome.runtime.getURL(`images/icons/512x512/${imageName}.png`)

  statusImage.setAttribute('src', imageSrc)
}

const showAdvertising = () => {
  advertisingBlocks.forEach((ad) => {
    ad.style.removeProperty('display')
  })
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

const interpolateCurrentDomain = (domain) => {
  currentDomainBlocks.forEach((element) => {
    element.innerText = domain
  })
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
  isForbidden.hidden = true
  isNotOriBlock.hidden = true
  isNotForbidden.hidden = true
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

btnAboutForbidden.addEventListener('click', () => {
  textAboutForbidden.style.display = 'block'
  btnAboutForbidden.style.display = 'none'
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
  btnAboutForbidden.style.display = 'flex'
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
  btnAboutForbidden.style.display = 'flex'
  textAboutNotForbidden.style.display = 'none'
  btnAboutNotForbidden.style.display = 'flex'
}
