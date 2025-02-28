import browser from 'Background/browser-api'
import ProxyClient from 'Background/localproxy'
import ProxyManager from 'Background/proxy'
import * as server from 'Background/server'

(async () => {
  const proxyingEnabled = await ProxyManager.isEnabled()
  const loading = document.getElementById('loading')
  const proxyIsDown = document.getElementById('proxyIsDown')
  const rksVPNBanner = document.getElementById('rksVPNBanner')
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
  const closeLocalProxyPopupButton = document.getElementById('closeLocalProxyPopup')
  const goBackLocalProxy = document.getElementById('goBackLocalProxy')
  const addLocalProxyConfigButton = document.getElementById('addLocalProxyConfigButton')
  const localProxyClientNotFound = document.getElementById('localProxyClientNotFound')
  const changeLocalProxyRadio = document.getElementById('changeLocalProxyRadio')
  const invalidLocalProxyConfig = document.getElementById('invalidLocalProxyConfig')
  const localProxyTextarea = document.getElementById('localProxyTextarea')
  const downloadLocalProxyButton = document.getElementById('downloadLocalProxyButton')

  ProxyManager.isEnabled().then((isEnabled) => {
    useProxyCheckbox.checked = isEnabled
  })

  ProxyManager.alive().then((alive) => {
    proxyIsDown.hidden = alive
  })

  proxyCustomOptions.hidden = !proxyingEnabled

  const closeLocalProxyPopup = () => {
    addLocalProxyPopup.style.display = 'none'
  }

  closeLocalProxyPopupButton.addEventListener('click', () => {
    closeLocalProxyPopup()
  })

  goBackLocalProxy.addEventListener('click', () => {
    closeLocalProxyPopup()
  })

  addLocalProxyButton.addEventListener('click', () => {
    invalidLocalProxyConfig.classList.add('hidden')
    addLocalProxyPopup.style.display = 'block'
    localProxyTextarea.value = ''
  })

  downloadLocalProxyButton.addEventListener('click', () => {
    window.open('https://github.com/censortracker/proxy/releases', '_blank')
  })

  // Handle deleting local proxy configs.
  changeLocalProxyRadio.addEventListener('click', async (event) => {
    const deleteButton = event.target.closest('.delete-config')

    if (!deleteButton) {
      return
    }

    const configId = deleteButton.dataset.id
    const proxyBlock = document.getElementById(`proxyconf-${configId}`)

    if (proxyBlock) {
      proxyBlock.classList.add('hidden')
    }

    try {
      const { status, message } = await ProxyClient.deleteConfig(configId, 250)

      if (status === 'success') {
        console.warn(`Config ${configId} has been deleted`)

        if (proxyBlock) {
          proxyBlock.remove()
          const remainingConfigs = changeLocalProxyRadio.querySelectorAll('.delete-config')

          if (remainingConfigs.length === 0) {
            rksVPNBanner.classList.remove('hidden')
            await ProxyManager.removeLocalProxy()
            await ProxyManager.setProxy()
          }
        }
      } else {
        console.error(`Failed to delete config: ${configId}: ${message}`)
        if (proxyBlock) {
          proxyBlock.classList.remove('hidden')
        }
      }
    } catch (error) {
      if (proxyBlock) {
        proxyBlock.classList.remove('hidden')
        console.error(`Error deleting config: ${configId}`, error)
      }
    }
  })

  const renderLocalProxyConfigs = async () => {
    const { configs = {} } = await ProxyClient.getConfig('', 350)

    if (Object.keys(configs).length === 0) {
      if (await ProxyManager.isEnabled()) {
        await ProxyManager.removeLocalProxy()
        await ProxyManager.setProxy()
        return
      }
    }

    if (changeLocalProxyRadio.innerHTML) {
      changeLocalProxyRadio.innerHTML = ''
    }

    loading.style.display = 'flex'

    for (const [id, { name, isActive }] of Object.entries(configs)) {
      const div = document.createElement('div')

      if (isActive) {
        await browser.storage.local.set({
          useLocalProxy: true,
          activeProxyConfigName: name,
        })
      }
      div.id = `proxyconf-${id}`
      div.className = 'proxy-list__block'
      div.innerHTML = `
       <div class="radio-button proxy-list__block-item">
        <input class="radio-button-input" type="radio" name="local-proxy" id="${id}" value="${id}"
          ${isActive ? 'checked' : ''} data-config-name="${name}"/>
        <label class="radio-button-label" for="${id}">${name}</label>
        <div class="proxy-list__block-item__btn delete-config" data-id="${id}">
          <svg class="close-icon" width="24" height="24" viewBox="0 0 44 44" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 10L34 34M34 10L10 34" stroke="currentColor" stroke-opacity="0.8" stroke-width="2"/>
          </svg>
        </div>
       </div>`
      changeLocalProxyRadio.append(div)
    }
    loading.style.display = 'none'

    if (await ProxyManager.isEnabled()) {
      await ProxyClient.setLocalProxyURI()
      await ProxyManager.setProxy()
    }
  }

  const showLocalProxySettings = async () => {
    const pingData = await ProxyClient.ping(500)

    if (Object.keys(pingData).length === 0) {
      addLocalProxyButton.style.display = 'none'
      localProxyOptions.style.display = 'block'
      localProxyClientNotFound.classList.remove('hidden')
    } else {
      localProxyOptions.style.display = 'block'
      addLocalProxyButton.style.display = 'inline-flex'

      if (!pingData.xray_running) {
        const { status, message } = await ProxyClient.start(1000)

        if (status === 'success') {
          console.log(message)
        } else {
          console.error(message)
        }
      }

      if (pingData && pingData.config_count === 0) {
        rksVPNBanner.classList.remove('hidden')
      }
    }
  }

  // Applying newly added local proxy config.
  addLocalProxyConfigButton.addEventListener('click', async () => {
    const value = localProxyTextarea.value.trim()
    const configs = await ProxyClient.parseConfig(value)

    if (configs.length > 0) {
      const data = await ProxyClient.setConfig({ configs })

      if (data && data.status === 'success') {
        rksVPNBanner.classList.add('hidden')
        await renderLocalProxyConfigs()
        closeLocalProxyPopup()
        return
      }
      console.error(data.message)
    }

    invalidLocalProxyConfig.classList.remove('hidden')
    setTimeout(() => {
      invalidLocalProxyConfig.classList.add('hidden')
    }, 7000)
  })

  // Switching between local proxy configs.
  changeLocalProxyRadio.addEventListener('change', async (event) => {
    const activeProxyConfigId = event.target.value.trim()
    const activeProxyConfigName = event.target.dataset.configName.trim()

    const { status, message } = await ProxyClient.activateConfig(
      activeProxyConfigId, 500,
    )

    if (status === 'success') {
      console.log(`Config ${activeProxyConfigId} has been activated`)
      await browser.storage.local.set({
        useLocalProxy: true,
        activeProxyConfigId,
        activeProxyConfigName,
      })
      await ProxyClient.setLocalProxyURI()
      await ProxyManager.setProxy()
    } else {
      console.error(message)
    }
  })

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
    await showLocalProxySettings()
    await renderLocalProxyConfigs()
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
      await server.synchronize({
        syncRegistry: true,
        syncProxy: true,
      })
      await ProxyManager.removeCustomProxy()
      await ProxyManager.removeLocalProxy()
      await ProxyManager.setProxy()
    } else if (value === 'custom') {
      proxyOptionsInputs.classList.remove('hidden')
      localProxyOptions.style.display = 'none'
      addLocalProxyButton.style.display = 'none'
    } else if (value === 'local') {
      proxyOptionsInputs.classList.add('hidden')
      await showLocalProxySettings()
      await renderLocalProxyConfigs()
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
