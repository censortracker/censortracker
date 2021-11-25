import { proxy, settings, storage, translateDocument } from '@/common/js'

(async () => {
  translateDocument(document)
  const useDPIDetectionCheckbox = document.getElementById('useDPIDetectionCheckbox')
  const showNotificationsCheckbox = document.getElementById('showNotificationsCheckbox')
  const howToGrantIncognitoAccess = document.getElementById('howToGrantIncognitoAccess')
  const grantPrivateBrowsingPermissionsButton = document.getElementById('grantPrivateBrowsingPermissionsButton')
  const privateBrowsingPermissionsRequiredMessage = document.getElementById('privateBrowsingPermissionsRequiredMessage')

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

  showNotificationsCheckbox.addEventListener('change', async () => {
    if (showNotificationsCheckbox.checked) {
      await settings.enableNotifications()
    } else {
      await settings.disableNotifications()
    }
  }, false)

  const { showNotifications } =
    await storage.get({ showNotifications: true })

  showNotificationsCheckbox.checked = showNotifications

  useDPIDetectionCheckbox.addEventListener('change', async () => {
    await storage.set({ useDPIDetection: useDPIDetectionCheckbox.checked })
  }, false)

  const { useDPIDetection } = await storage.get({ useDPIDetection: true })

  useDPIDetectionCheckbox.checked = useDPIDetection
})()
