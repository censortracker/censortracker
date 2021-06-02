import { proxy, settings, storage } from '@/common/js'

(async () => {
  const showNotificationsCheckbox = document.getElementById('showNotificationsCheckbox')
  const grantPrivateBrowsingPermissionsButton = document.getElementById('grantPrivateBrowsingPermissionsButton')
  const privateBrowsingPermissionsRequiredMessage = document.getElementById('privateBrowsingPermissionsRequiredMessage')
  const howToGrantPrivateBrowsingPermissions = document.getElementById('howToGrantPrivateBrowsingPermissions')

  if (settings.isFirefox) {
    const { privateBrowsingPermissionsRequired } = await storage.get({
      privateBrowsingPermissionsRequired: false,
    })

    howToGrantPrivateBrowsingPermissions.addEventListener('click', async () => {
      await browser.tabs.create({ url: 'https://mzl.la/3yPAS4H' })
    })

    if (privateBrowsingPermissionsRequired === true) {
      privateBrowsingPermissionsRequiredMessage.hidden = false

      grantPrivateBrowsingPermissionsButton.addEventListener('click', async () => {
        const proxySet = await proxy.setProxy()

        if (proxySet === true) {
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
})()
