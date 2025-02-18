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
  const localProxyTextarea = document.getElementById('localProxyTextarea')

  const hideLocalProxyPopup = () => {
    addLocalProxyPopup.style.display = 'none'
  }

  const showLocalProxyPopup = () => {
    addLocalProxyPopup.style.display = 'block'
    localProxyTextarea.value = ''
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
    const data = await ProxyClient.deleteConfig(id)

    console.log(`Deleting proxy config: ${id}`)

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
        addLocalProxyButton.style.display = 'none'
        return
      }

      if (respData.status === 'success') {
        console.log(`Saving local proxy port port: ${respData.xray_port}`)
        await browser.storage.local.set({
          localProxyPort: respData.xray_port,
        })
      }
    }).catch(() => {
      console.error('Local proxy client not found...')
      addLocalProxyButton.style.display = 'none'
    })

  const renderProxyListOptions = () => {
    ProxyClient.getConfig().then(async (data) => {
      console.log('Getting local proxy config...')

      if (!data) {
        return
      }

      const configs = data.configs || {}

      if (Object.keys(configs).length === 0) {
        rksVPNBanner.classList.remove('hidden')
        return
      }

      if (localProxyRadioList.innerHTML) {
        localProxyRadioList.innerHTML = ''
      }

      rksVPNBanner.classList.add('hidden')

      for (const [id, { name, isActive }] of Object.entries(configs)) {
        const proxyBlock = document.createElement('div')

        console.log(`Rendering: ${id} -> ${name}`)

        if (isActive) {
          await browser.storage.local.set({
            useLocalProxy: true,
            activeProxyConfigName: name,
          })
        }

        proxyBlock.className = 'proxy-list__block'
        proxyBlock.id = `proxyblock-${id}`
        proxyBlock.innerHTML = `
       <div class="radio-button proxy-list__block-item">
        <input class="radio-button-input" type="radio" name="local-proxy" id="${id}" value="${id}"
          ${isActive ? 'checked' : ''} />
        <label class="radio-button-label" for="${id}">${name}</label>
        <div class="proxy-list__block-item__btn deleteLocalConfig" data-id="${id}">
          <svg class="close-icon" width="24" height="24" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 10L34 34M34 10L10 34" stroke="currentColor" stroke-opacity="0.8" stroke-width="2"/>
          </svg>
        </div>
       </div>`
        localProxyRadioList.append(proxyBlock)
      }
    })
  }

  renderProxyListOptions()

  // Applying newly added local proxy config.
  applyLocalProxyConfigButton.addEventListener('click', async () => {
    const value = localProxyTextarea.value.trim()

    if (!ProxyClient.validateConfig(value)) {
      invalidLocalProxyConfig.classList.remove('hidden')
      return
    }

    const data = await ProxyClient.setConfig({ configs: [value] })

    if (data && data.status === 'success') {
      renderProxyListOptions()
      hideLocalProxyPopup()
      console.log('New proxy config has been added')
    } else {
      invalidLocalProxyConfig.classList.remove('hidden')
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

  const checkLocalProxyServer = async () => {
    const data = await ProxyClient.ping()
    const { localProxyPort } = await browser.storage.local.get('localProxyPort')

    if (data && data.status === 'success') {
      addLocalProxyButton.style.display = 'inline-flex'
      localProxyOptions.style.display = 'block'
      await browser.storage.local.set({ localProxyURI: `127.0.0.1:${localProxyPort}` })
      await ProxyManager.setProxy()
      console.warn('Local proxy server is running.')
    } else {
      addLocalProxyButton.style.display = 'none'
      localProxyOptions.style.display = 'block'
      localProxyClientNotFound.classList.remove('hidden')
      console.warn('Local proxy server is not running...')
    }
  }

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
    await checkLocalProxyServer()
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
      await checkLocalProxyServer()
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
