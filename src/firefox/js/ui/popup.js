import { translateDocument } from '../../../common/js/i18n'

translateDocument(document)

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
const restrictionDescription = getElementById('restriction-description')
const restrictionType = getElementById('restriction-type')
const currentDomainBlocks = document.querySelectorAll('.current-domain')
const privateBrowsingPermissionsRequiredButton = getElementById('privateBrowsingPermissionsRequiredButton')
const popupShowTimeout = 60

privateBrowsingPermissionsRequiredButton.addEventListener('click', () => {
  window.location.href = 'additional_permissions_required.html'
})

browser.runtime.getBackgroundPage(async ({ censortracker: bgModules }) => {
  document.addEventListener('click', async (event) => {
    if (event.target.matches('#enableExtension')) {
      await bgModules.settings.enableExtension()
      window.location.reload()
    }

    if (event.target.matches('#disableExtension')) {
      await bgModules.settings.disableExtension()
      window.location.reload()
    }

    if (event.target.matches('#openOptionsPage')) {
      await browser.runtime.openOptionsPage()
    }
  })

  const allowedIncognitoAccess = await browser.extension.isAllowedIncognitoAccess()
  const { enableExtension, privateBrowsingPermissionsRequired } = await bgModules.storage.get({
    enableExtension: true,
    privateBrowsingPermissionsRequired: false,
  })

  if (!allowedIncognitoAccess || privateBrowsingPermissionsRequired) {
    privateBrowsingPermissionsRequiredButton.hidden = false
  }

  const [{ url: currentUrl }] = await browser.tabs.query({
    active: true, lastFocusedWindow: true,
  })

  const currentHostname = bgModules.extractHostnameFromUrl(
    getAppropriateUrl(currentUrl),
  )

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

    const urlBlocked = await bgModules.registry.contains(currentHostname)

    if (urlBlocked) {
      changeStatusImage('blocked')
      restrictionsApplied.removeAttribute('hidden')
      restrictionsAreNotApplied.remove()
    } else {
      restrictionsAreNotApplied.removeAttribute('hidden')
      restrictionsApplied.remove()
      changeStatusImage('normal')
    }

    const { url: distributorUrl, cooperationRefused } =
      await bgModules.registry.distributorsContains(currentHostname)

    if (distributorUrl) {
      currentDomainHeader.classList.add('title-ori')
      isOriBlock.removeAttribute('hidden')
      isNotOriBlock.remove()

      if (cooperationRefused) {
        showCooperationRefusedMessage()
      } else {
        changeStatusImage('ori')
      }
    } else {
      isNotOriBlock.removeAttribute('hidden')
      isOriBlock.remove()
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
