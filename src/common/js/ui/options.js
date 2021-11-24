import { proxy, settings, storage, translateDocument } from '@/common/js'

(async () => {
  translateDocument(document)
  const optionsDPIDetectionCheckbox = document.getElementById('optionsDPIDetectionCheckbox')
  const showNotificationsCheckbox = document.getElementById('showNotificationsCheckbox')
  const grantPrivateBrowsingPermissionsButton = document.getElementById('grantPrivateBrowsingPermissionsButton')
  const privateBrowsingPermissionsRequiredMessage = document.getElementById('privateBrowsingPermissionsRequiredMessage')
  const howToGrantIncognitoAccess = document.getElementById('howToGrantIncognitoAccess')

  if (settings.isFirefox) {
    const allowedIncognitoAccess =
      await browser.extension.isAllowedIncognitoAccess()

    const { privateBrowsingPermissionsRequired } = await storage.get({
      privateBrowsingPermissionsRequired: false,
    })

    howToGrantIncognitoAccess.addEventListener('click', async () => {
      await browser.tabs.create({
        url: browser.i18n.getMessage('howToGrantIncognitoAccessLink'),
      })
    })

    if (privateBrowsingPermissionsRequired || !allowedIncognitoAccess) {
      privateBrowsingPermissionsRequiredMessage.hidden = false

      grantPrivateBrowsingPermissionsButton.addEventListener('click', async () => {
        const proxySet = await proxy.setProxy()

        if (proxySet === true) {
          await proxy.grantIncognitoAccess()
          privateBrowsingPermissionsRequiredMessage.hidden = true
        }
      })
    }
  }

  showNotificationsCheckbox.addEventListener(
    'change', async () => {
      if (showNotificationsCheckbox.checked) {
        await settings.enableNotifications()
      } else {
        await settings.disableNotifications()
      }
    }, false)

  const { showNotifications } =
    await storage.get({ showNotifications: true })

  showNotificationsCheckbox.checked = showNotifications

  optionsDPIDetectionCheckbox.addEventListener(
    'change', async () => {
      // TODO: Implement logic
    }, false)
})()
