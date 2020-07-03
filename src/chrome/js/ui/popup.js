const statusImage = document.getElementById('statusImage')
const statusDomain = document.getElementById('statusDomain')
const footerTrackerOff = document.getElementById('footerTrackerOff')
const trackerOff = document.getElementById('trackerOff')
const isOriBlock = document.getElementById('isOriBlock')
const isNotOriBlock = document.getElementById('isNotOriBlock')
const isForbidden = document.getElementById('isForbidden')
const isNotForbidden = document.getElementById('isNotForbidden')
const footerTrackerOn = document.getElementById('footerTrackerOn')
const btnAboutOri = document.getElementById('btnAboutOri')
const textAboutOri = document.getElementById('textAboutOri')
const closeTextAboutOri = document.getElementById('closeTextAboutOri')
const btnAboutForbidden = document.getElementById('btnAboutForbidden')
const textAboutForbidden = document.getElementById('textAboutForbidden')
const closeTextAboutForbidden = document.getElementById('closeTextAboutForbidden')
const btnAboutNotForbidden = document.getElementById('btnAboutNotForbidden')
const textAboutNotForbidden = document.getElementById('textAboutNotForbidden')
const closeTextAboutNotForbidden = document.getElementById('closeTextAboutNotForbidden')
const btnAboutNotOri = document.getElementById('btnAboutNotOri')
const textAboutNotOri = document.getElementById('textAboutNotOri')
const closeTextAboutNotOri = document.getElementById('closeTextAboutNotOri')
const currentDomain = document.getElementById('currentDomain')
const oriSiteInfo = document.getElementById('oriSiteInfo')

const POPUP_SHOW_TIMEOUT = 100

const showCooperationRefusedMessage = () => {
  oriSiteInfo.innerText = 'Сайт внесен в ОРИ, однако отказался от сотрудничество с властями.'
  textAboutOri.classList.remove('text-warning')
  textAboutOri.classList.add('text-normal')
  console.log('Cooperation refused')
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

  setTimeout(show, POPUP_SHOW_TIMEOUT)
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
