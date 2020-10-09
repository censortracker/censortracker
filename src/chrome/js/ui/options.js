import asynchrome from '../core/asynchrome'
import proxy from '../core/proxy'

(async () => {
  const { censortracker: { chromeListeners } } = await asynchrome.runtime.getBackgroundPage()

  const useProxyCheckbox = document.getElementById('useProxyCheckbox')
  const isProxyControlledByThisExtension = await proxy.controlledByThisExtension()
  const isProxyControlledByOtherExtensions = await proxy.controlledByOtherExtensions()

  if (isProxyControlledByOtherExtensions) {
    useProxyCheckbox.checked = false
    useProxyCheckbox.disabled = true
    await asynchrome.storage.local.set({ useProxyChecked: false })
  } else if (isProxyControlledByThisExtension) {
    useProxyCheckbox.checked = true
    useProxyCheckbox.disabled = false
    await asynchrome.storage.local.set({ useProxyChecked: true })
  } else {
    await asynchrome.storage.local.set({ useProxyChecked: false })
    useProxyCheckbox.disabled = false
  }

  useProxyCheckbox.addEventListener('change', async () => {
    if (useProxyCheckbox.checked) {
      if (!chromeListeners.has()) {
        chromeListeners.add()
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

  const { useProxyChecked } = await asynchrome.storage.local.get({
    useProxyChecked: true,
  })

  useProxyCheckbox.checked = useProxyChecked
})()
