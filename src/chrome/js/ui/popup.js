// window.jQuery('body').tooltip({
//   selector: '[data-toggle="tooltip"]',
// })
const statusImage = document.querySelector('#statusImage')
const popupFooter = document.querySelector('#popupFooter')
const lastSyncDate = document.querySelector('#lastSyncDate')
const oriMatchFound = document.querySelector('#oriMatchFound')
const registryMatchFound = document.querySelector('#matchFound')
const vpnAdvertising = document.querySelector('#vpnAdvertising')
const extensionStatus = document.querySelector('#extensionStatus')
const extensionStatusLabel = document.querySelector('#extensionStatusLabel')
const cooperationAccepted = document.querySelector('#cooperationAccepted')
const cooperationRejected = document.querySelector('#cooperationRejected')
const currentDomain = document.querySelector('#currentDomain')
const extensionName = document.querySelector('#extensionName')
const redIcon = chrome.extension.getURL('images/red_icon.png')

chrome.runtime.getBackgroundPage(async (bgWindow) => {
  const { settings, proxies, registry, shortcuts, Database } = bgWindow.censortracker

  extensionName.innerText = settings.getTitle()

  const updateExtensionStatusLabel = () => {
    let labelText = 'Расширение выключено'
    let tooltipStatus = 'выключен'
    const extName = settings.getName()

    if (extensionStatus.checked) {
      labelText = 'Расширение включено'
      tooltipStatus = 'включен'
    }
    extensionStatusLabel.innerText = labelText
    extensionStatusLabel.setAttribute('title', `${extName} ${tooltipStatus}`)
  }

  document.addEventListener('click', (event) => {
    if (event.target.matches(`#${extensionStatus.id}`)) {
      updateExtensionStatusLabel()
      if (extensionStatus.checked) {
        popupFooter.hidden = false
        shortcuts.enableExtension()
        proxies.setProxy()
      } else {
        popupFooter.hidden = true
        proxies.removeProxy()
        shortcuts.disableExtension()
      }
    }
  })

  const config = await Database.get(['enableExtension'])

  if (config.enableExtension) {
    extensionStatus.checked = config.enableExtension
  }

  chrome.tabs.query(
    {
      active: true,
      lastFocusedWindow: true,
    },
    async (tabs) => {
      const activeTab = tabs[0]
      const activeTabUrl = activeTab.url

      if (activeTabUrl.startsWith('chrome-extension://')) {
        popupFooter.hidden = true
        return
      }

      const urlObject = new URL(activeTabUrl)
      const currentHostname = shortcuts.cleanHostname(urlObject.hostname)

      if (shortcuts.validURL(currentHostname)) {
        currentDomain.innerText = currentHostname.replace('www.', '')
      }

      updateExtensionStatusLabel()

      if (config.enableExtension) {
        registry.getLastSyncTimestamp().then((timestamp) => {
          lastSyncDate.innerText = timestamp.replace(/\//g, '.')
        })

        registry.checkDomains(currentHostname, {
          onMatchFound: (_data) => {
            registryMatchFound.innerHTML = shortcuts.createSearchLink(currentHostname)
            vpnAdvertising.hidden = false
            statusImage.setAttribute('src', redIcon)
          },
        })

        registry.checkDistributors(currentHostname, {
          onMatchFound: (cooperationRefused) => {
            oriMatchFound.innerHTML = shortcuts.createSearchLink(currentHostname)
            vpnAdvertising.hidden = false
            statusImage.setAttribute('src', redIcon)

            if (cooperationRefused) {
              cooperationRejected.hidden = false
            } else {
              cooperationAccepted.hidden = false
            }
          },
        })
      } else {
        popupFooter.hidden = true
      }
    },
  )

  const show = () => {
    document.documentElement.style.visibility = 'initial'
  }

  setTimeout(show, 165)
})
