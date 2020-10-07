(() => {
  const backToPopup = document.getElementById('backToPopup')
  const extensionsLink = document.getElementsByClassName('extensions__link')
  const extensionNameElements = document.getElementsByClassName('extension__name')
  const extensionsWhichControlsProxy = document.getElementById('extensionsWhichControlsProxy')
  const controlledByExtension = document.getElementById('controlledByOtherExtension')
  const controlledByExtensions = document.getElementById('controlledByOtherExtensions')

  chrome.runtime.getBackgroundPage(async ({ censortracker: bgModules }) => {
    const self = await bgModules.asynchrome.management.getSelf()
    const extensions = await bgModules.asynchrome.management.getAll()

    const extensionsWithProxyPermissions = extensions.filter(({ name, permissions }) => {
      return permissions.includes('proxy') && name !== self.name
    })

    if (extensionsWithProxyPermissions.length > 1) {
      controlledByExtensions.hidden = false

      let result = ''

      for (const { name, shortName } of extensionsWithProxyPermissions) {
        result += `<li>${shortName || name}</li>`
      }
      extensionsWhichControlsProxy.innerHTML = result
    } else {
      controlledByExtension.hidden = false

      const [{ shortName, name }] = extensionsWithProxyPermissions

      Array.from(extensionNameElements).forEach((element) => {
        element.innerText = shortName || name
      })
    }

    Array.from(extensionsLink).forEach((element) => {
      element.addEventListener('click', () => {
        chrome.tabs.create({ url: 'chrome://extensions/' })
      })
    })
  })

  if (backToPopup) {
    backToPopup.addEventListener('click', () => {
      window.location.href = chrome.runtime.getURL('popup.html')
    })
  }

  const show = () => {
    document.documentElement.style.visibility = 'initial'
  }

  setTimeout(show, 100)
})()
