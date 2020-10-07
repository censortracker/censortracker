(async () => {
  chrome.runtime.getBackgroundPage(async ({ censortracker: bgModules }) => {
    const { asynchrome, proxy } = bgModules
    const useProxyCheckbox = document.getElementById('useProxyCheckbox')

    const { value: proxySettingsValue } = await asynchrome.proxy.settings.get()

    if (Object.hasOwnProperty.call(proxySettingsValue, 'pacScript')) {
      if (Object.hasOwnProperty.call(proxySettingsValue.pacScript, 'data')) {
        await asynchrome.storage.local.set({ useProxy: true })
      }
    }
    const { useProxy } = await asynchrome.storage.local.get({ useProxy: true })

    useProxyCheckbox.checked = useProxy

    useProxyCheckbox.addEventListener('change', async () => {
      if (useProxyCheckbox.checked) {
        await proxy.setProxy()
        await asynchrome.storage.local.set({ useProxy: true })
      } else {
        await asynchrome.storage.local.set({ useProxy: false })
        await asynchrome.proxy.settings.clear({ scope: 'regular' }).catch(console.error)
      }
    }, false)
  })
})()
