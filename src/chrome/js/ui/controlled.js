(() => {
  const backToPopup = document.getElementById('backToPopup')
  const extensionsLink = document.getElementsByClassName('extensions__link')
  const extensionNameElements = document.getElementsByClassName('extension__name')
  const extensionsWhichControlsProxy = document.getElementById('extensionsWhichControlsProxy')
  const controlledByExtension = document.getElementById('controlledByExtension')
  const controlledByExtensions = document.getElementById('controlledByExtensions')

  const createExtensionLink = (name) => `<a class="extensions__link">${name}</a>`

  chrome.runtime.getBackgroundPage(async ({ censortracker: bg }) => {
    const self = await bg.asynchrome.management.getSelf()
    const extensions = await bg.asynchrome.management.getAll()

    const extensionsWithProxyPermission = extensions.filter(({ name, permissions }) => {
      return permissions.includes('proxy') && name !== self.name
    })

    if (extensionsWithProxyPermission.length > 1) {
      controlledByExtensions.hidden = false
      controlledByExtension.hidden = true
      let result = ''

      for (const { name, shortName } of extensionsWithProxyPermission) {
        result += `<li>${createExtensionLink(shortName || name)}</li>`
      }
      extensionsWhichControlsProxy.innerHTML = result
    } else {
      controlledByExtension.hidden = false
      controlledByExtensions.hidden = true

      const extension = extensionsWithProxyPermission[0]

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
