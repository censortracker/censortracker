(() => {
  const backToPopup = document.getElementById('backToPopup')
  const extensionsLink = document.getElementsByClassName('extensions__link')
  const extensionNameElements = document.getElementsByClassName('extension__name')
  const extensionsWhichControlsProxy = document.getElementById('extensionsWhichControlsProxy')
  const controlledByExtension = document.getElementById('controlledByExtension')
  const controlledByExtensions = document.getElementById('controlledByExtensions')

  chrome.runtime.getBackgroundPage(async ({ censortracker: bgModules }) => {
    const self = await bgModules.asynchrome.management.getSelf()
    const extensions = await bgModules.asynchrome.management.getAll()

    const extensionsWithProxyPermissions = extensions.filter(({ name, permissions }) => {
      return permissions.includes('proxy') && name !== self.name
    })

    if (extensionsWithProxyPermissions.length > 1) {
      controlledByExtensions.hidden = false
      controlledByExtension.hidden = true
      let result = ''

      for (const { name, shortName } of extensionsWithProxyPermissions) {
        result += `<li>${shortName || name}</li>`
      }
      extensionsWhichControlsProxy.innerHTML = result
    } else {
      controlledByExtension.hidden = false
      controlledByExtensions.hidden = true

      const extension = extensionsWithProxyPermissions[0]

      Array.from(extensionNameElements).forEach((element) => {
        element.innerText = extension.shortName || extensions.name
      })
    }

    Array.from(extensionsLink).forEach((element) => {
      element.addEventListener('click', () => {
        chrome.tabs.create({ url: 'chrome://extensions/' })
      })
    })
  })

  backToPopup.addEventListener('click', () => {
    window.location.href = chrome.runtime.getURL('popup.html')
  })

  const show = () => {
    document.documentElement.style.visibility = 'initial'
  }

  setTimeout(show, 100)
})()
