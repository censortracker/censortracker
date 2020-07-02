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
      const activeTab = tabs[0]
      const activeTabUrl = activeTab.url

      if (activeTabUrl.startsWith('chrome-extension://')) {
        return
      }

      const urlObject = new URL(activeTabUrl)
      const hostname = shortcuts.cleanHostname(urlObject.hostname)

      if (shortcuts.validURL(hostname)) {
        statusDomain.innerText = hostname.replace('www.', '')
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
          changeStatusImage('ori')
          statusDomain.classList.add('title-ori')
          isOriBlock.removeAttribute('hidden')

          if (cooperationRefused) {
            console.log('Cooperation refused')
          } else {
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

  setTimeout(show, 100)
})

btnAboutOri.addEventListener('click',
  () => {
    textAboutOri.style.display = 'block'
    btnAboutOri.style.display = 'none'
    textAboutForbidden.style.display = 'none'
    btnAboutForbidden.style.display = 'flex'
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

closeTextAboutForbidden.addEventListener('click',
  () => {
    textAboutForbidden.style.display = 'none'
    btnAboutForbidden.style.display = 'flex'
  },
)
