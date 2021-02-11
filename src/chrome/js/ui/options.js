import asynchrome from '../core/asynchrome'
import proxy from '../core/proxy'

(async () => {
  const { censortracker: { events } } = await asynchrome.runtime.getBackgroundPage()

  const useProxyCheckbox = document.getElementById('useProxyCheckbox')
  const showNotificationsCheckbox = document.getElementById('showNotificationsCheckbox')
  const isProxyControlledByThisExtension = await proxy.controlledByThisExtension()
  const isProxyControlledByOtherExtensions = await proxy.controlledByOtherExtensions()

  if (isProxyControlledByOtherExtensions) {
    useProxyCheckbox.checked = false
    useProxyCheckbox.disabled = true
    await asynchrome.storage.local.set({ useProxy: false })
  } else if (isProxyControlledByThisExtension) {
    useProxyCheckbox.checked = true
    useProxyCheckbox.disabled = false
    await asynchrome.storage.local.set({ useProxy: true })
  } else {
    await asynchrome.storage.local.set({ useProxy: false })
    useProxyCheckbox.disabled = false
  }

  useProxyCheckbox.addEventListener('change', async () => {
    if (useProxyCheckbox.checked) {
      if (!events.has()) {
        events.add()
      }

      await proxy.setProxy()
      useProxyCheckbox.checked = true
      console.log('Proxying enabled.')
    } else {
      await proxy.removeProxy()
      useProxyCheckbox.checked = false
      console.warn('Proxying disabled.')
    }
  }, false)

  showNotificationsCheckbox.addEventListener('change', async () => {
    if (showNotificationsCheckbox.checked) {
      await asynchrome.storage.local.set({ showNotifications: true })
      console.log('Notifications enabled.')
    } else {
      console.warn('Notifications disabled.')
      await asynchrome.storage.local.set({ showNotifications: false })
    }
  }, false)

  const { useProxy, showNotifications } =
    await asynchrome.storage.local.get({
      useProxy: true,
      showNotifications: true,
    })

  useProxyCheckbox.checked = useProxy
  showNotificationsCheckbox.checked = showNotifications
})()
