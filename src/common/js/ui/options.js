import { settings, storage } from '@/common/js'

(async () => {
  const showNotificationsCheckbox = document.getElementById('showNotificationsCheckbox')

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
