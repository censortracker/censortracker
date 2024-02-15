import browser from 'Background/browser-api'
import ProxyManager from 'Background/proxy'

(async () => {
  const proxyingEnabled = await ProxyManager.isEnabled()
  const proxyIsDown = document.getElementById('proxyIsDown')
  const proxyServerInput = document.getElementById('proxyServerInput')
  const saveCustomProxyButton = document.getElementById('saveCustomProxyButton')
  const useProxyCheckbox = document.getElementById('useProxyCheckbox')
  const proxyCustomOptions = document.getElementById('proxyCustomOptions')
  const proxyOptionsInputs = document.getElementById('proxyOptionsInputs')
  const useCustomProxyRadioButton = document.getElementById('useCustomProxy')
  const useDefaultProxyRadioButton = document.getElementById('useDefaultProxy')
  const proxyCustomOptionsRadioGroup = document.getElementById(
    'proxyCustomOptionsRadioGroup',
  )
  const selectProxyProtocol = document.querySelector('.select')
  const currentProxyProtocol = document.querySelector('#select-toggle')
  const proxyProtocols = document.querySelectorAll('.select-option')

  ProxyManager.alive().then((alive) => {
    proxyIsDown.hidden = alive
  })

  proxyCustomOptions.hidden = !proxyingEnabled

  const {
    useOwnProxy,
    customProxyProtocol,
    customProxyServerURI,
  } = await browser.storage.local.get([
    'useOwnProxy',
    'customProxyProtocol',
    'customProxyServerURI',
  ])

  if (customProxyProtocol) {
    currentProxyProtocol.textContent = customProxyProtocol
  }

  if (useOwnProxy) {
    proxyOptionsInputs.hidden = false
    useCustomProxyRadioButton.checked = true
    proxyOptionsInputs.classList.remove('hidden')
  } else {
    proxyOptionsInputs.classList.add('hidden')
    useDefaultProxyRadioButton.checked = true
  }

  if (customProxyServerURI) {
    proxyServerInput.value = customProxyServerURI
  }

  saveCustomProxyButton.addEventListener('click', async (event) => {
    const customProxyServer = proxyServerInput.value
    const proxyProtocol = currentProxyProtocol.textContent.trim()

    if (customProxyServer) {
      await browser.storage.local.set({
        useOwnProxy: true,
        customProxyProtocol: proxyProtocol,
        customProxyServerURI: customProxyServer,
      })

      await ProxyManager.setProxy()
      proxyServerInput.classList.remove('invalid-input')

      console.log(`Proxy host changed to: ${customProxyServer}`)
    } else {
      proxyServerInput.classList.add('invalid-input')
    }
  })

  proxyCustomOptionsRadioGroup.addEventListener('change', async (event) => {
    if (event.target.value === 'default') {
      proxyOptionsInputs.classList.add('hidden')
      proxyServerInput.value = ''
      await ProxyManager.removeCustomProxy()
      await ProxyManager.setProxy()
    } else {
      proxyOptionsInputs.classList.remove('hidden')
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

  document.addEventListener('click', (event) => {
    if (event.target.id === 'select-toggle') {
      selectProxyProtocol.classList.toggle('show-protocols')
    }

    if (!event.target.closest('.select')) {
      for (const element of document.querySelectorAll('.show-protocols')) {
        element.classList.remove('show-protocols')
      }
    }
  })

  for (const option of proxyProtocols) {
    option.addEventListener('click', async (event) => {
      selectProxyProtocol.classList.remove('show-protocols')

      currentProxyProtocol.value = event.target.dataset.value
      currentProxyProtocol.textContent = event.target.dataset.value
    })
  }
})()
