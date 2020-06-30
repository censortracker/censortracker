const statusImage = document.getElementById('statusImage')
const statusDomain = document.getElementById('statusDomain')
const footerTrackerOff = document.getElementById('footerTrackerOff')
const trackerOff = document.getElementById('trackerOff')
const isOri = document.getElementById('isOri')
const isNotOri = document.getElementById('isNotOri')
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

  const { enableExtension } = await Database.get(['enableExtension'])

  if (enableExtension) {
    statusImage.setAttribute('src', 'images/icons/512x512/normal.png')
    statusDomain.classList.add('title-normal')
    isForbidden.remove()
    trackerOff.remove()
    footerTrackerOff.remove()
  } else {
    statusImage.setAttribute('src', 'images/icons/512x512/disabled.png')
    statusDomain.remove()
    isOri.remove()
    isNotOri.remove()
    isForbidden.remove()
    isNotForbidden.remove()
    footerTrackerOn.remove()
    statusDomain.remove()
  }

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
        registry.domainsContains(hostname).then((_data) => {
          statusImage.setAttribute('src', settings.getPopupImage({
            size: 512,
            name: 'blocked',
          }))
        })

        const { url, cooperationRefused } = await registry.distributorsContains(hostname)

        if (url) {
          statusDomain.classList.add('title-ori')
          isNotOri.remove()
          isForbidden.remove()
          trackerOff.remove()
          footerTrackerOff.remove()

          if (cooperationRefused) {
            console.log('Cooperation refused')
          } else {
            console.warn('Cooperation accepted!')
          }
        } else {
          isOri.remove()
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
