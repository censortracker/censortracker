import { proxy } from '@/common/js'

(async () => {
  const useProxyCheckbox = document.getElementById('useProxyCheckbox')
  const isProxyControlledByThisExtension = await proxy.controlledByThisExtension()
  const isProxyControlledByOtherExtensions = await proxy.controlledByOtherExtensions()

  if (isProxyControlledByOtherExtensions) {
    useProxyCheckbox.checked = false
    useProxyCheckbox.disabled = true
    await proxy.disableProxy()
  } else if (isProxyControlledByThisExtension) {
    useProxyCheckbox.checked = true
    useProxyCheckbox.disabled = false
    await proxy.enableProxy()
  } else {
    await proxy.disableProxy()
    useProxyCheckbox.disabled = false
  }

  useProxyCheckbox.addEventListener('change', async () => {
    if (useProxyCheckbox.checked) {
      await proxy.enableProxy()
      useProxyCheckbox.checked = true
    } else {
      await proxy.disableProxy()
      useProxyCheckbox.checked = false
    }
  }, false)

  useProxyCheckbox.checked = await proxy.proxyingEnabled()
})()
