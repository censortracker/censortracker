import validator from 'validator'

import { proxy, registry, storage, translateDocument } from '@/common/js'

(async () => {
  const proxyingEnabled = await proxy.enabled()
  const useProxyCheckbox = document.getElementById('useProxyCheckbox')
  const proxyCustomOptions = document.getElementById('proxyCustomOptions')
  const proxyHostInput = document.getElementById('proxyHostInput')
  const proxyPortInput = document.getElementById('proxyPortInput')
  const proxyStatusIsDown = document.getElementById('proxyStatusIsDown')
  const proxyOptionsInputs = document.getElementById('proxyOptionsInputs')
  const proxyCustomOptionsRadioGroup = document.getElementById('proxyCustomOptionsRadioGroup')
  const isProxyControlledByThisExtension = await proxy.controlledByThisExtension()
  const isProxyControlledByOtherExtensions = await proxy.controlledByOtherExtensions()
  const useCustomProxyRadioButton = document.getElementById('useCustomProxy')
  const useDefaultProxyRadioButton = document.getElementById('useDefaultProxy')

  const proxyIsAlive = await proxy.alive()

  if (!proxyIsAlive) {
    proxyStatusIsDown.hidden = false
  }

  proxyCustomOptions.hidden = !proxyingEnabled

  const { customProxyHost, customProxyPort, useCustomChecked } =
    await storage.get(['customProxyHost', 'customProxyPort', 'useCustomChecked'])

  if (useCustomChecked) {
    proxyOptionsInputs.hidden = false
    useCustomProxyRadioButton.checked = true
    proxyOptionsInputs.classList.remove('hidden')
  } else {
    proxyOptionsInputs.classList.add('hidden')
    useDefaultProxyRadioButton.checked = true
  }

  if (customProxyHost) {
    proxyHostInput.value = customProxyHost
  }

  if (customProxyPort) {
    proxyPortInput.value = customProxyPort
  }

  document.addEventListener('keydown', async (event) => {
    const host = proxyHostInput.value
    const port = proxyPortInput.value
    const customProxyServerURI = `${host}:${port}`

    if ((event.ctrlKey && event.key === 's') || event.keyCode === 13) {
      if (host && validator.isPort(port)) {
        await storage.set({ useCustomChecked: true })
        await storage.set({ customProxyPort: port, customProxyHost: host })
        await storage.set({ customProxyServerURI })
        await proxy.setProxy()

        proxyHostInput.classList.remove('invalid-input')
        proxyPortInput.classList.remove('invalid-input')
        console.log(`Proxy host changed to: ${customProxyServerURI}`)
      } else {
        proxyHostInput.classList.add('invalid-input')
        proxyPortInput.classList.add('invalid-input')
      }
      event.preventDefault()
    }
  })

  proxyCustomOptionsRadioGroup.addEventListener('change', async (event) => {
    if (event.target.value !== 'default') {
      await proxy.setProxy()
      proxyOptionsInputs.classList.remove('hidden')
    } else {
      await proxy.setProxy()
      await storage.set({ useCustomChecked: false })
      await storage.remove(['customProxyHost', 'customProxyPort', 'customProxyServerURI'])
      proxyOptionsInputs.classList.add('hidden')
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

    if (!proxyingEnabled) {
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

  useProxyCheckbox.checked = await proxy.enabled()

  const { countryDetails: { name: country } } = await registry.getConfig()

  translateDocument(document, { country })
})()
