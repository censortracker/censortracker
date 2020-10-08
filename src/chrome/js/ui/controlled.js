(() => {
  const backToPopup = document.getElementById('backToPopup')
  const disableOtherExtensionsButtons = document.getElementsByClassName('disable-other-extensions__btn')
  const extensionNameElements = document.getElementsByClassName('extension__name')
  const extensionsWhichControlsProxy = document.getElementById('extensionsWhichControlsProxy')
  const controlledByExtension = document.getElementById('controlledByOtherExtension')
  const controlledByExtensions = document.getElementById('controlledByOtherExtensions')
  const useProxyCheckbox = document.getElementById('useProxyCheckbox')

  chrome.runtime.getBackgroundPage(async ({ censortracker: { asynchrome, proxy } }) => {
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

      Array.from(disableOtherExtensionsButtons).forEach((element) => {
        element.addEventListener('click', async () => {
          for (const { id } of extensionsWithProxyPermissions) {
            await asynchrome.management.setEnabled(id, false)
          }

          const currentPage = window.location.pathname.split('/').pop()

          if (currentPage.startsWith('controlled')) {
            window.location.href = 'popup.html'
          }

          if (currentPage.startsWith('options')) {
            if (await proxy.controlledByThisExtensions()) {
              useProxyCheckbox.checked = true
              useProxyCheckbox.disabled = false
            }
            element.parentElement.hidden = true
          }
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
