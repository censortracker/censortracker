(async () => {
  const useProxyCheckbox = document.getElementById('useProxyCheckbox')

  chrome.runtime.getBackgroundPage(async ({ censortracker: bgModules }) => {
    const { asynchrome, proxy } = bgModules

    const isProxyControlledByOtherExtensions =
      await proxy.controlledByOtherExtensions()

    if (isProxyControlledByOtherExtensions) {
      await proxy.removeProxy()
      await asynchrome.storage.local.set({ useProxy: false })
    } else {
      await asynchrome.storage.local.set({ useProxy: true })
    }

    const { useProxy } = await asynchrome.storage.local.get({ useProxy: true })

    useProxyCheckbox.checked = useProxy

    useProxyCheckbox.addEventListener('change', async () => {
      if (useProxyCheckbox.checked) {
        await proxy.setProxy()
        await asynchrome.storage.local.set({ useProxy: true })
      } else {
        await proxy.removeProxy()
        await asynchrome.storage.local.set({ useProxy: false })
      }
    }, false)
  })
})()
