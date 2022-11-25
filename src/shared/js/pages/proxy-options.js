import Browser from 'Background/browser-api'
import ProxyManager from 'Background/proxy'

(async () => {
  const proxyingEnabled = await ProxyManager.isEnabled()
  const proxyIsDown = document.getElementById('proxyIsDown')
  const proxyHostInput = document.getElementById('proxyHostInput')
  const proxyPortInput = document.getElementById('proxyPortInput')
  const useProxyCheckbox = document.getElementById('useProxyCheckbox')
  const proxyCustomOptions = document.getElementById('proxyCustomOptions')
  const proxyOptionsInputs = document.getElementById('proxyOptionsInputs')
  const useCustomProxyRadioButton = document.getElementById('useCustomProxy')
  const useDefaultProxyRadioButton = document.getElementById('useDefaultProxy')
  const proxyCustomOptionsRadioGroup = document.getElementById('proxyCustomOptionsRadioGroup')

  const isPort = (value) => {
    try {
      const port = parseInt(value, 10)

      return port >= 0 && port < (2 ** 16)
    } catch (error) {
      return false
    }
  }

  ProxyManager.alive().then((alive) => {
    proxyIsDown.hidden = alive
  })

  proxyCustomOptions.hidden = !proxyingEnabled

  const { customProxyHost, customProxyPort, useCustomChecked } =
    await Browser.storage.local.get(['customProxyHost', 'customProxyPort', 'useCustomChecked'])

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
      if (host && isPort(port)) {
        await Browser.storage.local.set({
          useCustomChecked: true,
          customProxyPort: port,
          customProxyHost: host,
          customProxyServerURI,
        })
        await ProxyManager.setProxy()

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
      proxyOptionsInputs.classList.remove('hidden')
      await ProxyManager.setProxy()
    } else {
      proxyOptionsInputs.classList.add('hidden')
      await Browser.storage.local.set({ useCustomChecked: false })
      await Browser.storage.local.remove(['customProxyHost', 'customProxyPort', 'customProxyServerURI'])
      await ProxyManager.setProxy()
    }
  })

  ProxyManager.controlledByThisExtension()
    .then(async (controlledByThisExtension) => {
      if (controlledByThisExtension) {
        useProxyCheckbox.checked = true
        useProxyCheckbox.disabled = false

        if (!proxyingEnabled) {
          await ProxyManager.enableProxy()
        }
      }
    })
  ProxyManager.controlledByOtherExtensions()
    .then(async (controlledByOtherExtensions) => {
      if (controlledByOtherExtensions) {
        useProxyCheckbox.checked = false
        useProxyCheckbox.disabled = true
        await ProxyManager.disableProxy()
      }
    })

  useProxyCheckbox.addEventListener('change', async () => {
    if (useProxyCheckbox.checked) {
      proxyCustomOptions.hidden = false
      useProxyCheckbox.checked = true
      await ProxyManager.enableProxy()
    } else {
      proxyCustomOptions.hidden = true
      useProxyCheckbox.checked = false
      proxyIsDown.hidden = true
      await ProxyManager.disableProxy()
    }
  }, false)

  ProxyManager.isEnabled().then((isEnabled) => {
    useProxyCheckbox.checked = isEnabled
  })
})()
