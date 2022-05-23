import ProxyManager from 'Background/proxy'
import { select, translateDocument } from 'Background/utilities'

(async () => {
  translateDocument(document)
  const backToPopup = select({ id: 'backToPopup' })
  const disableOtherExtensionsButtons = select({ cls: 'disable-other-extensions__btn' })
  const extensionNameElements = select({ cls: 'extension__name' })
  const extensionsWhichControlsProxy = select({ id: 'extensionsWhichControlsProxy' })
  const controlledByExtension = select({ id: 'controlledByOtherExtension' })
  const controlledByExtensions = select({ id: 'controlledByOtherExtensions' })
  const useProxyCheckbox = select({ id: 'useProxyCheckbox' })

  const isProxyControlledByOtherExtensions = await ProxyManager.controlledByOtherExtensions()

  if (isProxyControlledByOtherExtensions) {
    const self = await chrome.management.getSelf()
    const extensions = await chrome.management.getAll()

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

      translateDocument(document, { extensionName: shortName })

      Array.from(extensionNameElements).forEach((element) => {
        element.innerText = shortName || name
      })
    }

    Array.from(disableOtherExtensionsButtons).forEach((element) => {
      element.addEventListener('click', async () => {
        const currentPage = window.location.pathname.split('/').pop()

        for (const { id } of extensionsWithProxyPermissions) {
          await chrome.management.setEnabled(id, false)
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
