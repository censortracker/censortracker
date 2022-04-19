import { proxy, translateDocument } from '@/common/scripts'

(async () => {
  translateDocument(document)
  const backToPopup = document.getElementById('backToPopup')
  const disableOtherExtensionsButtons = document.getElementsByClassName('disable-other-extensions__btn')
  const extensionNameElements = document.getElementsByClassName('extension__name')
  const extensionsWhichControlsProxy = document.getElementById('extensionsWhichControlsProxy')
  const controlledByExtension = document.getElementById('controlledByOtherExtension')
  const controlledByExtensions = document.getElementById('controlledByOtherExtensions')
  const useProxyCheckbox = document.getElementById('useProxyCheckbox')

  const isProxyControlledByOtherExtensions = await proxy.controlledByOtherExtensions()

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
          if (await proxy.controlledByThisExtension()) {
            useProxyCheckbox.checked = true
            useProxyCheckbox.disabled = false
          }
          element.parentElement.hidden = true
        }
        await proxy.setProxy()
        window.location.reload()
      })
    })
  }

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
