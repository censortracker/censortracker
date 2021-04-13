import asynchrome from '../core/asynchrome'
import proxy from '../core/proxy'

(async () => {
  const { censortracker: { storage } } = await asynchrome.runtime.getBackgroundPage()

  const useProxyCheckbox = document.getElementById('useProxyCheckbox')
  const showNotificationsCheckbox = document.getElementById('showNotificationsCheckbox')
  const isProxyControlledByThisExtension = await proxy.controlledByThisExtension()
  const isProxyControlledByOtherExtensions = await proxy.controlledByOtherExtensions()

  if (isProxyControlledByOtherExtensions) {
    useProxyCheckbox.checked = false
    useProxyCheckbox.disabled = true
    await storage.set({ useProxy: false })
  } else if (isProxyControlledByThisExtension) {
    useProxyCheckbox.checked = true
    useProxyCheckbox.disabled = false
    await storage.set({ useProxy: true })
  } else {
    await storage.set({ useProxy: false })
    useProxyCheckbox.disabled = false
  }

  useProxyCheckbox.addEventListener('change', async () => {
    if (useProxyCheckbox.checked) {
      useProxyCheckbox.checked = true
      console.log('Proxying enabled.')
    } else {
      useProxyCheckbox.checked = false
      console.warn('Proxying disabled.')
    }
  }, false)

  showNotificationsCheckbox.addEventListener('change', async () => {
    if (showNotificationsCheckbox.checked) {
      await storage.set({ showNotifications: true })
      console.log('Notifications enabled.')
    } else {
      console.warn('Notifications disabled.')
      await storage.set({ showNotifications: false })
    }
  }, false)

  const { useProxy, showNotifications } =
    await storage.get({
      useProxy: true,
      showNotifications: true,
    })

  useProxyCheckbox.checked = useProxy
  showNotificationsCheckbox.checked = showNotifications
})()
