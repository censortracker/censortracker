import ProxyManager from 'Background/proxy'
import { translateDocument } from 'Background/utilities'
import Browser from 'Background/webextension'

(async () => {
  translateDocument(document)
  const backToPopup = document.querySelector('#backToPopup')
  const useProxyCheckbox = document.querySelector('#useProxyCheckbox')
  const controlledByExtension = document.querySelector('#controlledByOtherExtension')
  const controlledByExtensions = document.querySelector('#controlledByOtherExtensions')
  const disableOtherExtensionsButtons = document.querySelectorAll('.disable-other-extensions')
  const extensionsWhichControlsProxy = document.querySelector('#extensionsWhichControlsProxy')

  const isProxyControlledByOtherExtensions = await ProxyManager.controlledByOtherExtensions()

  if (isProxyControlledByOtherExtensions) {
    const self = await Browser.management.getSelf()
    const installedExtensions = await Browser.management.getAll()

    const extensionsWithProxyPermissions = installedExtensions.filter(({ name, permissions }) => {
      return permissions.includes('proxy') && name !== self.name
    })

    if (extensionsWithProxyPermissions.length === 1) {
      controlledByExtension.hidden = false

      const [{ name }] = extensionsWithProxyPermissions

      translateDocument(document, { extensionName: name })
    } else if (extensionsWithProxyPermissions.length > 1) {
      for (const { name, shortName } of extensionsWithProxyPermissions) {
        const item = document.createElement('li')

        item.textContent = `${shortName || name}`

        extensionsWhichControlsProxy.append(item)
      }
      controlledByExtensions.hidden = false
    }

    Array.from(disableOtherExtensionsButtons).forEach((element) => {
      console.log(element)
      element.addEventListener('click', async () => {
        const currentPage = window.location.pathname.split('/').pop()

        console.log(`Clicked: ${currentPage}`)

        for (const { id } of extensionsWithProxyPermissions) {
          await Browser.management.setEnabled(id, false)
        }

        if (currentPage.startsWith('controlled')) {
          window.location.href = 'popup.html'
        }

        if (currentPage.startsWith('options')) {
          if (await ProxyManager.controlledByThisExtension()) {
            useProxyCheckbox.checked = true
            useProxyCheckbox.disabled = false
          }
          element.parentElement.hidden = true
        }
        await ProxyManager.setProxy()
        window.location.reload()
      })
    })
  }

  if (backToPopup) {
    backToPopup.addEventListener('click', () => {
      window.location.href = 'popup.html'
    })
  }

  const show = () => {
    document.documentElement.style.visibility = 'initial'
  }

  setTimeout(show, 100)
})()
