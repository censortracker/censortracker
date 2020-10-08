(async () => {
  chrome.runtime.getBackgroundPage(async ({ censortracker: { asynchrome, proxy } }) => {
    await proxy.allowProxying()

    const useProxyCheckbox = document.getElementById('useProxyCheckbox')
    const isProxyControlledByThisExtension = await proxy.controlledByThisExtensions()
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
        await proxy.setProxy()
        await proxy.allowProxying()
        useProxyCheckbox.checked = true
        await asynchrome.storage.local.set({ useProxyChecked: true })
      } else {
        await proxy.removeProxy()
        await asynchrome.storage.local.set({
          useProxyChecked: false,
          proxyingPaused: true,
        })
        useProxyCheckbox.checked = false
      }
    }, false)

    const { useProxyChecked } = await asynchrome.storage.local.get({
      useProxyChecked: true,
    })

    useProxyCheckbox.checked = useProxyChecked
  })
})()
