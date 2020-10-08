(() => {
  const backToPopup = document.getElementById('backToPopup')
  const extensionsLink = document.getElementsByClassName('extensions__link')
  const extensionNameElements = document.getElementsByClassName('extension__name')
  const extensionsWhichControlsProxy = document.getElementById('extensionsWhichControlsProxy')
  const controlledByExtension = document.getElementById('controlledByOtherExtension')
  const controlledByExtensions = document.getElementById('controlledByOtherExtensions')

  // eslint-disable-next-line no-unused-vars
  const disableExtensionsWithProxyPermissions = async (asynchrome) => {
    const self = await asynchrome.management.getSelf()
    const extensions = await asynchrome.management.getAll()
    const extensionsWithProxyPermissions = extensions.filter(({ name, permissions }) => {
      return permissions.includes('proxy') && name !== self.name
    })

    extensionsWithProxyPermissions.forEach(({ id }) =>
      chrome.management.setEnabled(id, false))
  }

  chrome.runtime.getBackgroundPage(async ({ censortracker: bgModules }) => {
    const { asynchrome, proxy } = bgModules

    const isProxyControlledByOtherExtensions = await proxy.controlledByOtherExtensions()

    if (isProxyControlledByOtherExtensions) {
      const self = await asynchrome.management.getSelf()
      const extensions = await asynchrome.management.getAll()

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
    }
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
