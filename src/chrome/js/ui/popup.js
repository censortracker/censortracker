const getElementById = (id) => document.getElementById(id)

const statusImage = getElementById('statusImage')
const statusDomain = getElementById('statusDomain')
const footerTrackerOff = getElementById('footerTrackerOff')
const trackerOff = getElementById('trackerOff')
const isOriBlock = getElementById('isOriBlock')
const isNotOriBlock = getElementById('isNotOriBlock')
const isForbidden = getElementById('isForbidden')
const isNotForbidden = getElementById('isNotForbidden')
const footerTrackerOn = getElementById('footerTrackerOn')
const btnAboutOri = getElementById('btnAboutOri')
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
const currentDomain = getElementById('currentDomain')
const oriSiteInfo = getElementById('oriSiteInfo')
const popupShowTimeout = 100

const showCooperationRefusedMessage = () => {
  oriSiteInfo.innerText = 'Сервис заявил, что они не передают трафик российским ' +
    'государственным органам в автоматическом режиме.'
  textAboutOri.classList.remove('text-warning')
  textAboutOri.classList.add('text-normal')
  statusDomain.classList.remove('title-ori')
  statusDomain.classList.add('title-normal')
}

chrome.runtime.getBackgroundPage(async (bgWindow) => {
  const {
    settings,
    proxies,
    registry,
    shortcuts,
    Database,
  } = bgWindow.censortracker

  const changeStatusImage = (imageName) => {
    statusImage.setAttribute('src', settings.getPopupImage({
      size: 512,
      name: imageName,
    }))
  }

  const mutatePopup = ({ enabled }) => {
    if (enabled) {
      changeStatusImage('normal')
      statusDomain.classList.add('title-normal')
      statusDomain.removeAttribute('hidden')
      footerTrackerOn.removeAttribute('hidden')
    } else {
      changeStatusImage('disabled')
      trackerOff.removeAttribute('hidden')
      footerTrackerOff.removeAttribute('hidden')
      isOriBlock.setAttribute('hidden', 'true')
      isForbidden.setAttribute('hidden', 'true')
      isNotOriBlock.setAttribute('hidden', 'true')
      isNotForbidden.setAttribute('hidden', 'true')
    }
  }

  const { enableExtension } = await Database.get(['enableExtension'])

  mutatePopup({ enabled: enableExtension })

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

  chrome.tabs.query(
    {
      active: true,
      lastFocusedWindow: true,
    },
    async (tabs) => {
      const tab = tabs[0]
      const tabUrl = tab.url

      if (shortcuts.isChromeExtensionUrl(tabUrl)) {
        return
      }

      const urlObject = new URL(tabUrl)
      const hostname = shortcuts.cleanHostname(urlObject.hostname)

      if (shortcuts.validURL(hostname)) {
        const rawDomain = hostname.replace('www.', '')

        statusDomain.innerText = rawDomain
        currentDomain.innerText = rawDomain
      }

      if (enableExtension) {
        // TODO: Add state for cases when site is in ORI and blocked

        const domains = await registry.domainsContains(hostname)

        if (domains.length > 0) {
          console.log(`Domains ${JSON.stringify(domains)}`)
          changeStatusImage('blocked')
          isNotForbidden.setAttribute('hidden', '')
          isForbidden.removeAttribute('hidden')
        } else {
          isNotForbidden.removeAttribute('hidden')
          changeStatusImage('normal')
        }

        const { url, cooperationRefused } = await registry.distributorsContains(hostname)

        if (url) {
          statusDomain.classList.add('title-ori')
          isOriBlock.removeAttribute('hidden')

          if (cooperationRefused) {
            showCooperationRefusedMessage()
          } else {
            changeStatusImage('ori')
            console.warn('Cooperation accepted!')
          }
        } else {
          isNotOriBlock.removeAttribute('hidden')
          console.log('Match not found at all')
        }
      } else {
        statusImage.setAttribute('src',
          settings.getPopupImage({
            size: 512,
            name: 'disabled',
          }),
        )
      }
    },
  )

  const show = () => {
    document.documentElement.style.visibility = 'initial'
  }

  setTimeout(show, popupShowTimeout)
})

btnAboutOri.addEventListener('click',
  () => {
    textAboutOri.style.display = 'block'
    btnAboutOri.style.display = 'none'
    textAboutForbidden.style.display = 'none'
    btnAboutForbidden.style.display = 'flex'
  },
)

btnAboutNotOri.addEventListener('click',
  () => {
    textAboutNotOri.style.display = 'block'
    btnAboutNotOri.style.display = 'none'
    textAboutForbidden.style.display = 'none'
    btnAboutForbidden.style.display = 'flex'
  },
)

closeTextAboutNotOri.addEventListener('click',
  () => {
    textAboutNotOri.style.display = 'none'
    btnAboutNotOri.style.display = 'flex'
  },
)

closeTextAboutOri.addEventListener('click',
  () => {
    textAboutOri.style.display = 'none'
    btnAboutOri.style.display = 'flex'
  },
)

btnAboutForbidden.addEventListener('click',
  () => {
    textAboutForbidden.style.display = 'block'
    btnAboutForbidden.style.display = 'none'
    textAboutOri.style.display = 'none'
    btnAboutOri.style.display = 'flex'
  },
)

btnAboutNotForbidden.addEventListener('click',
  () => {
    textAboutNotForbidden.style.display = 'block'
    btnAboutNotForbidden.style.display = 'none'
    textAboutOri.style.display = 'none'
    btnAboutOri.style.display = 'flex'
  })

closeTextAboutForbidden.addEventListener('click',
  () => {
    textAboutForbidden.style.display = 'none'
    btnAboutForbidden.style.display = 'flex'
  },
)

closeTextAboutNotForbidden.addEventListener('click', () => {
  textAboutNotForbidden.style.display = 'none'
  btnAboutNotForbidden.style.display = 'flex'
})
