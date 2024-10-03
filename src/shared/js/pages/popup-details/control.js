import browser from '../../browser-api'
import { translateDocument } from '../../utilities'
import { sendExtensionCallMsg } from '../messaging'

export const showControllingExtensions = async () => {
  const source = 'controlled'
  const i18nPageProps = {}
  const useProxyCheckbox = document.querySelector('#useProxyCheckbox')
  const controlledByExtension = document.querySelector('#controlledByOtherExtension')
  const controlledByExtensions = document.querySelector('#controlledByOtherExtensions')
  const disableOtherExtensionsButtons = document.querySelectorAll('.disable-other-extensions')
  const extensionsWhichControlsProxy = document.querySelector('#extensionsWhichControlsProxy')
  const proxyControlledByOtherExtensions =
    await sendExtensionCallMsg(source, 'controlledByOtherExtensions')

  if (proxyControlledByOtherExtensions) {
    const self = await browser.management.getSelf()
    const installedExtensions = await browser.management.getAll()

    const extensionsWithProxyPermissions =
      installedExtensions.filter(({ name, permissions, enabled }) => {
        return permissions.includes('proxy') && name !== self.name && enabled
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

      sendExtensionCallMsg(source, 'takeControl')

      if (currentPage.startsWith('controlled')) {
        window.close()
      }

      if (currentPage.startsWith('proxy-options')) {
        if (await sendExtensionCallMsg(source, 'controlledByThisExtension')) {
          useProxyCheckbox.checked = true
          useProxyCheckbox.disabled = false
        }
        disableButton.parentElement.hidden = true
      }

      window.location.reload()
    })
  }
  translateDocument(document, i18nPageProps)
}
