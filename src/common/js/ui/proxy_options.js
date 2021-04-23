import validator from 'validator'

import { proxy, storage } from '@/common/js'

(async () => {
  const proxyEnabled = await proxy.proxyingEnabled()
  const useProxyCheckbox = document.getElementById('useProxyCheckbox')
  const proxyCustomOptions = document.getElementById('proxyCustomOptions')
  const proxyHostInput = document.getElementById('proxyHostInput')
  const proxyPortInput = document.getElementById('proxyPortInput')
  const proxyInputs = document.querySelectorAll('.input-proxy')
  const proxyCustomOptionsRadioGroup = document.getElementById('proxyCustomOptionsRadioGroup')
  const isProxyControlledByThisExtension = await proxy.controlledByThisExtension()
  const isProxyControlledByOtherExtensions = await proxy.controlledByOtherExtensions()

  proxyCustomOptions.hidden = !proxyEnabled

  const { customProxyHost, customProxyPort } =
    await storage.get(['customProxyHost', 'customProxyPort'])

  if (customProxyHost) {
    proxyHostInput.value = customProxyHost
  }

  if (customProxyPort) {
    proxyPortInput.value = customProxyPort
  }

  for (const input of proxyInputs) {
    input.addEventListener('input', async (event) => {
      const value = event.target.value
      const isPortInput = event.target.classList.contains('port')
      const isHostInput = event.target.classList.contains('host')

      if (isHostInput) {
        if (validator.isIP(value) || validator.isFQDN(value)) {
          await storage.set({ customProxyHost: value })
          console.log(`Proxy host set to: ${value}`)
        }
      }

      if (isPortInput) {
        if (validator.isPort(value)) {
          await storage.set({ customProxyPort: value })
          console.log(`Proxy port set to: ${value}`)
        }
      }
    })
  }

  proxyCustomOptionsRadioGroup.addEventListener('change', async (event) => {
    const value = event.target.value

    if (value !== 'default') {
      await proxy.setProxy()
    } else {
      await storage.set({
        customProxyHost: undefined,
        customProxyPort: undefined,
      })
    }
  })

  if (isProxyControlledByOtherExtensions) {
    useProxyCheckbox.checked = false
    useProxyCheckbox.disabled = true
    await proxy.disableProxy()
  }

  if (isProxyControlledByThisExtension) {
    useProxyCheckbox.checked = true
    useProxyCheckbox.disabled = false

    if (!proxyEnabled) {
      await proxy.enableProxy()
    }
  }

  useProxyCheckbox.addEventListener('change', async () => {
    if (useProxyCheckbox.checked) {
      await proxy.enableProxy()
      proxyCustomOptions.hidden = false
      useProxyCheckbox.checked = true
    } else {
      await proxy.disableProxy()
      proxyCustomOptions.hidden = true
      useProxyCheckbox.checked = false
    }
  }, false)

  useProxyCheckbox.checked = await proxy.proxyingEnabled()
})()
