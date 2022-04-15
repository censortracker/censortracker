import { proxy, settings, storage, translateDocument } from '@/common/js';

(async () => {
  translateDocument(document)
  const currentBrowser = settings.getBrowser()
  const proxyingEnabled = await proxy.enabled()
  const proxyStatus = document.getElementById('proxyStatus')
  const showNotificationsCheckbox = document.getElementById(
    'showNotificationsCheckbox',
  )
  const howToGrantIncognitoAccess = document.getElementById(
    'howToGrantIncognitoAccess',
  )
  const grantPrivateBrowsingPermissionsButton = document.getElementById(
    'grantPrivateBrowsingPermissionsButton',
  )
  const privateBrowsingPermissionsRequiredMessage = document.getElementById(
    'privateBrowsingPermissionsRequiredMessage',
  )

  if (proxyStatus) {
    let proxyStatusMessage = 'optionsProxyStatusTurnedOff'

    if (proxyingEnabled) {
      proxyStatusMessage = 'optionsProxyStatusTurnedOn'
    }
    proxyStatus.innerText = currentBrowser.i18n.getMessage(proxyStatusMessage)
    proxyStatus.hidden = false
  }

  if (settings.isFirefox) {
    const allowedIncognitoAccess =
      await browser.extension.isAllowedIncognitoAccess()
    const { privateBrowsingPermissionsRequired } = await storage.get({
      privateBrowsingPermissionsRequired: false,
    })

    if (grantPrivateBrowsingPermissionsButton) {
      grantPrivateBrowsingPermissionsButton.hidden = !allowedIncognitoAccess
    }

    if (howToGrantIncognitoAccess) {
      howToGrantIncognitoAccess.addEventListener('click', async () => {
        await browser.tabs.create({
          url: browser.i18n.getMessage('howToGrantIncognitoAccessLink'),
        })
      })
    }

    if (privateBrowsingPermissionsRequired || !allowedIncognitoAccess) {
      privateBrowsingPermissionsRequiredMessage.hidden = false

      if (grantPrivateBrowsingPermissionsButton) {
        grantPrivateBrowsingPermissionsButton.addEventListener(
          'click',
          async () => {
            const proxySet = await proxy.setProxy()

            if (proxySet === true) {
              await proxy.grantIncognitoAccess()
              privateBrowsingPermissionsRequiredMessage.hidden = true
            }
          },
        )
      }
    }
  }

  if (showNotificationsCheckbox) {
    showNotificationsCheckbox.addEventListener(
      'change',
      async () => {
        if (showNotificationsCheckbox.checked) {
          await settings.enableNotifications()
        } else {
          await settings.disableNotifications()
        }
      },
      false,
    )

    const { showNotifications } = await storage.get({
      showNotifications: true,
    })

    showNotificationsCheckbox.checked = showNotifications
  }
})()
