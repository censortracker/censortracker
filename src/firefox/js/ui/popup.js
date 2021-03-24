const getElementById = (id) => document.getElementById(id)

const statusImage = getElementById('statusImage')
const oriInfoTitle = getElementById('ori-info-title')
const oriStatusIcon = getElementById('ori-status-icon')
const oriDescription = getElementById('ori-description')

const turnedOff = getElementById('turned-off')
const turnedOn = getElementById('turned-on')

const restrictionsInfoTitle = getElementById('restrictions-info-title')
const restrictionsDescription = getElementById('restrictions-description')
const restrictionsStatusIcon = getElementById('restrictions-status-icon')

const currentDomainBlocks = document.querySelector('.current-domain')
const popupShowTimeout = 60

browser.runtime.getBackgroundPage(async ({ censortracker: bgModules }) => {
  document.addEventListener('click', async (event) => {
    if (event.target.matches('#enableExtension')) {
      await bgModules.settings.enableExtension()
      turnedOff.hidden = true
      turnedOn.hidden = false
      window.location.reload()
    }

    if (event.target.matches('#disableExtension')) {
      await bgModules.settings.disableExtension()
      turnedOff.hidden = false
      turnedOn.hidden = true
      window.location.reload()
    }

    if (event.target.matches('#openOptionsPage')) {
      await browser.runtime.openOptionsPage()
    }
  })

  const { enableExtension } = await bgModules.storage.get({ enableExtension: true })

  const [{ url: currentUrl }] = await browser.tabs.query({
    active: true, lastFocusedWindow: true,
  })

  const currentHostname = bgModules.extractHostnameFromUrl(
    getAppropriateUrl(currentUrl),
  )

  currentDomainBlocks.forEach((element) => {
    element.innerText = currentHostname
  })

  if (enableExtension) {
    changeStatusImage('normal')

    const { domainFound } = await bgModules.registry.domainsContains(currentHostname)

    if (domainFound) {
      restrictionsInfoTitle.innerText = restrictionsInfoTitle.getAttribute('data-restrictions')
      restrictionsDescription.innerText = restrictionsDescription.getAttribute('data-restrictions-desc')
      restrictionsStatusIcon.setAttribute('src', restrictionsStatusIcon.getAttribute('data-restrictions-icon'))
      changeStatusImage('blocked')
    } else {
      changeStatusImage('normal')
      restrictionsDescription.innerText = restrictionsDescription.getAttribute('data-no-restrictions-desc')
      restrictionsInfoTitle.innerText = restrictionsInfoTitle.getAttribute('data-no-restrictions')
      restrictionsStatusIcon.setAttribute('src', restrictionsStatusIcon.getAttribute('data-no-restrictions-icon'))
    }

    const { url: distributorUrl, cooperationRefused } =
      await bgModules.registry.distributorsContains(currentHostname)

    if (distributorUrl) {
      oriInfoTitle.innerText = oriInfoTitle.getAttribute('data-ori')
      oriStatusIcon.setAttribute('src', oriStatusIcon.getAttribute('data-ori-icon'))
      oriDescription.innerText = oriDescription.getAttribute('data-ori')

      if (cooperationRefused) {
        oriDescription.innerText = oriDescription.getAttribute('data-ori-refused')
      } else {
        changeStatusImage('ori')
        console.warn('Cooperation accepted!')
      }
    } else {
      console.log('Match not found at all')
      oriInfoTitle.innerText = oriInfoTitle.getAttribute('data-not-ori')
      oriStatusIcon.setAttribute('src', oriStatusIcon.getAttribute('data-not-ori-icon'))
      oriDescription.innerText = oriDescription.getAttribute('data-not-ori')
    }

    if (domainFound && distributorUrl) {
      if (cooperationRefused === false) {
        changeStatusImage('ori_blocked')
      }
    }
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
