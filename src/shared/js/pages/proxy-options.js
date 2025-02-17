import browser from 'Background/browser-api'
import ProxyClient from 'Background/localproxy'
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
  const useLocalProxyRadioButton = document.getElementById('useLocalProxy')
  const proxyCustomOptionsRadioGroup = document.getElementById('proxyCustomOptionsRadioGroup')
  const selectProxyProtocol = document.querySelector('.select')
  const currentProxyProtocol = document.querySelector('#select-toggle')
  const proxyProtocols = document.querySelectorAll('.select-option')
  const localProxyOptions = document.getElementById('localProxyOptions')
  const addLocalProxyButton = document.getElementById('addLocalProxyButton')
  const addLocalProxyPopup = document.getElementById('addLocalProxyPopup')
  const closeLocalProxyPopup = document.getElementById('closeLocalProxyPopup')
  const goBackLocalProxy = document.getElementById('goBackLocalProxy')
  const applyLocalProxyConfigButton = document.getElementById('applyLocalProxyConfigButton')
  const localProxyClientNotFound = document.getElementById('localProxyClientNotFound')
  const rksVPNBanner = document.getElementById('rksVPNBanner')
  const localProxyRadioList = document.getElementById('localProxyRadioList')
  const invalidLocalProxyConfig = document.getElementById('invalidLocalProxyConfig')

  const hideLocalProxyPopup = () => {
    addLocalProxyPopup.style.display = 'none'
  }

  const showLocalProxyPopup = () => {
    addLocalProxyPopup.style.display = 'block'
  }

  addLocalProxyButton.addEventListener('click', () => {
    showLocalProxyPopup()
  })

  closeLocalProxyPopup.addEventListener('click', () => {
    hideLocalProxyPopup()
  })

  goBackLocalProxy.addEventListener('click', () => {
    hideLocalProxyPopup()
  })

  // Handle deleting local proxy configs.
  localProxyRadioList.addEventListener('click', async (event) => {
    const deleteButton = event.target.closest('.deleteLocalConfig')

    if (!deleteButton) {
      return
    }

    const id = deleteButton.dataset.id

    console.log(`Deleting proxy config: ${id}`)

    const data = await ProxyClient.deleteConfig(id)

    if (data && data.status === 'success') {
      console.warn(`Config ${id} has been deleted`)
      const proxyBlock = document.getElementById(`proxyblock-${id}`)

      if (proxyBlock) {
        proxyBlock.remove()
      }
    } else {
      console.error(`Failed to delete config: ${id}. Proxy server is not running...`)
    }
  })

  // Starting local proxy and saving port.
  ProxyClient.startProxy()
    .then(async (respData) => {
      console.log(`Starting proxy: ${respData}`)

      if (!respData) {
        localProxyClientNotFound.classList.remove('hidden')
        addLocalProxyButton.style.display = 'none'
        return
      }

      if (respData.status === 'success') {
        console.log(`Saving local proxy port port: ${respData.xray_port}`)
        await browser.storage.local.set({
          localProxyPort: respData.xray_port,
        })
        // addLocalProxyButton.style.display = 'inline-flex'
        // localProxyOptions.style.display = 'block'
        // localProxyClientNotFound.classList.add('hidden')
      }
    }).catch(() => {
      localProxyClientNotFound.classList.remove('hidden')
      addLocalProxyButton.style.display = 'none'
    })

  ProxyClient.getConfig().then((data) => {
    console.log('Getting local proxy config...')

    if (!data) {
      return
    }

    const configs = data.configs

    if (!configs) {
      rksVPNBanner.classList.remove('hidden')
      return
    }

    rksVPNBanner.classList.add('hidden')

    for (const [id, { name }] of Object.entries(configs)) {
      const proxyBlock = document.createElement('div')

      console.log(`Rendering: ${id} -> ${name}`)

      proxyBlock.className = 'proxy-list__block'
      proxyBlock.id = `proxyblock-${id}`
      proxyBlock.innerHTML = `
       <div class="radio-button proxy-list__block-item">
        <input class="radio-button-input" type="radio" name="local-proxy" id="${id}" value="${id}"/>
        <label class="radio-button-label" for="${id}">${name}</label>
        <div class="proxy-list__block-item__btn deleteLocalConfig" data-id="${id}">
            <img src="../images/settings/close_icon.svg" width="24"/>
        </div>
       </div>`
      localProxyRadioList.append(proxyBlock)
    }
  })

  // Applying newly added local proxy config.
  applyLocalProxyConfigButton.addEventListener('click', async () => {
    const textarea = document.getElementById('localProxyTextarea')
    const value = textarea.value.trim()

    const data = await ProxyClient.setConfig({ configs: [value] })

    if (!data) {
      console.log('Proxy server is not running...')
      return
    }

    if (!ProxyClient.validateConfig(value)) {
      invalidLocalProxyConfig.classList.remove('hidden')
      return
    }

    if (data.status === 'success') {
      console.log('Config set')
      hideLocalProxyPopup()
    }
  })

  // Switching between local proxy configs.
  localProxyRadioList.addEventListener('change', async (event) => {
    const configId = event.target.value.trim()
    const data = await ProxyClient.activateConfig(configId)

    console.log(`Selected config: ${configId} -> ${data}`)

    await browser.storage.local.set({
      useLocalProxy: true,
      activeProxyConfigId: configId,
    })
  })

  ProxyManager.alive().then((alive) => {
    proxyIsDown.hidden = alive
  })

  proxyCustomOptions.hidden = !proxyingEnabled

  const {
    useOwnProxy,
    useLocalProxy,
    customProxyProtocol,
    customProxyServerURI,
  } = await browser.storage.local.get([
    'useOwnProxy',
    'useLocalProxy',
    'customProxyProtocol',
    'customProxyServerURI',
  ])

  if (customProxyProtocol) {
    currentProxyProtocol.textContent = customProxyProtocol
  }

  if (useLocalProxy) {
    useLocalProxyRadioButton.checked = true
    addLocalProxyButton.style.display = 'inline-flex'
    localProxyOptions.style.display = 'block'
    const response = await ProxyClient.ping()

    if (response && response.status === 'success') {
      localProxyClientNotFound.classList.add('hidden')
    } else {
      localProxyClientNotFound.classList.remove('hidden')
    }
  } else if (useOwnProxy) {
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
    const value = event.target.value

    if (value === 'default') {
      proxyOptionsInputs.classList.add('hidden')
      proxyServerInput.value = ''
      localProxyOptions.style.display = 'none'
      addLocalProxyButton.style.display = 'none'
      await ProxyManager.removeCustomProxy()
      await ProxyManager.removeLocalProxy()
      await ProxyManager.setProxy()
    } else if (value === 'custom') {
      proxyOptionsInputs.classList.remove('hidden')
      localProxyOptions.style.display = 'none'
      addLocalProxyButton.style.display = 'none'
    } else if (value === 'local') {
      proxyOptionsInputs.classList.add('hidden')
      // localProxyOptions.style.display = 'block'
      // addLocalProxyButton.style.display = 'inline-flex'
      // const { localProxyPort } = await browser.storage.local.get('localProxyPort')
      //
      // await browser.storage.local.set({
      //   localProxyURI: `127.0.0.1:${localProxyPort}`,
      // })
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
