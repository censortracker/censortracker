(async () => {
  const { censortracker: { browserListeners, settings, proxy } } = await browser.runtime.getBackgroundPage()

  const useProxyCheckbox = document.getElementById('useProxyCheckbox')
  const useNotificationsCheckbox = document.getElementById('useNotificationsCheckbox')

  useProxyCheckbox.addEventListener('change', async () => {
    if (useProxyCheckbox.checked) {
      await proxy.enableProxy()

      if (!browserListeners.has()) {
        browserListeners.add()
      }
      useProxyCheckbox.checked = true
    } else {
      await proxy.disableProxy()
      useProxyCheckbox.checked = false
    }
  }, false)

  useNotificationsCheckbox.addEventListener('change', async () => {
    if (useNotificationsCheckbox.checked) {
      await settings.enableNotifications()
    } else {
      await settings.disableNotifications()
    }
  }, false)

  const { useProxyChecked, useNotificationsChecked } =
    await browser.storage.local.get({
      useProxyChecked: true,
      useNotificationsChecked: true,
    })

  useProxyCheckbox.checked = useProxyChecked
  useNotificationsCheckbox.checked = useNotificationsChecked
})()
