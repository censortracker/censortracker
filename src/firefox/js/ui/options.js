import { proxy, settings, storage } from '@/common/js'

(async () => {
  const useProxyCheckbox = document.getElementById('useProxyCheckbox')
  const showNotificationsCheckbox = document.getElementById('showNotificationsCheckbox')

  useProxyCheckbox.addEventListener('change', async () => {
    if (useProxyCheckbox.checked) {
      await proxy.enableProxy()
      useProxyCheckbox.checked = true
    } else {
      await proxy.disableProxy()
      useProxyCheckbox.checked = false
    }
  }, false)

  showNotificationsCheckbox.addEventListener('change', async () => {
    if (showNotificationsCheckbox.checked) {
      await settings.enableNotifications()
    } else {
      await settings.disableNotifications()
    }
  }, false)

  const { useProxy, showNotifications } = await storage.get({
    useProxy: true,
    showNotifications: true,
  })

  useProxyCheckbox.checked = useProxy
  showNotificationsCheckbox.checked = showNotifications
})()
