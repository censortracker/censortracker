import ProxyManager from 'Background/proxy'
import { translateDocument } from 'Background/utilities'
import Browser from 'Background/webextension'

(async () => {
  const i18nPageProps = {}
  const backToPopup = document.querySelector('#backToPopup')
  const useProxyCheckbox = document.querySelector('#useProxyCheckbox')
  const controlledByExtension = document.querySelector('#controlledByOtherExtension')
  const controlledByExtensions = document.querySelector('#controlledByOtherExtensions')
  const disableOtherExtensionsButtons = document.querySelectorAll('.disable-other-extensions')
  const extensionsWhichControlsProxy = document.querySelector('#extensionsWhichControlsProxy')
  const proxyControlledByOtherExtensions = await ProxyManager.controlledByOtherExtensions()

  if (proxyControlledByOtherExtensions) {
    const self = await Browser.management.getSelf()
    const installedExtensions = await Browser.management.getAll()

    const extensionsWithProxyPermissions = installedExtensions.filter(({ name, permissions }) => {
      return permissions.includes('proxy') && name !== self.name
    })

    if (extensionsWithProxyPermissions.length === 1) {
      controlledByExtension.hidden = false

      i18nPageProps.extensionName = extensionsWithProxyPermissions[0].name
    } else if (extensionsWithProxyPermissions.length > 1) {
      for (const { name, shortName } of extensionsWithProxyPermissions) {
        const item = document.createElement('li')

        item.textContent = `${shortName || name}`

        extensionsWhichControlsProxy.append(item)
      }
      controlledByExtensions.hidden = false
    }
  }

  for (const disableButton of disableOtherExtensionsButtons) {
    disableButton.addEventListener('click', async () => {
      const currentPage = window.location.pathname.split('/').pop()

      await ProxyManager.takeControl()
      await ProxyManager.setProxy()

      if (currentPage.startsWith('controlled')) {
        window.close()
      }

      if (currentPage.startsWith('proxy-options')) {
        if (await ProxyManager.controlledByThisExtension()) {
          useProxyCheckbox.checked = true
          useProxyCheckbox.disabled = false
        }
        disableButton.parentElement.hidden = true
      }

      window.location.reload()
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

  translateDocument(document, i18nPageProps)
  setTimeout(show, 100)
})()
