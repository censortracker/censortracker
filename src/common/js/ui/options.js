import { proxy, settings, storage } from '@/common/js'

(async () => {
  const showNotificationsCheckbox = document.getElementById('showNotificationsCheckbox')
  const openBrowserSettings = document.getElementById('openBrowserSettings')
  const grantPrivateWindowsPermissionButton = document.getElementById('grantPrivateWindowsPermissionButton')
  const privateWindowsPermissionRequiredMessage = document.getElementById('privateWindowsPermissionRequiredMessage')
  const howToGrantPrivateWindowsPermission = document.getElementById('howToGrantPrivateWindowsPermission')

  grantPrivateWindowsPermissionButton.addEventListener('click', async () => {
    const proxySet = await proxy.setProxy()

    if (proxySet === true) {
      window.location.href = browser.runtime.getURL('popup.html')
    } else {
      howToGrantPrivateWindowsPermission.style.color = 'hsl(348, 100%, 61%)'
    }
  })

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
