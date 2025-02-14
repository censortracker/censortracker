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

  ProxyClient.ping().then((data) => {
    if (data && data.xray_state === 'running') {
      localProxyClientNotFound.classList.add('hidden')
    } else {
      localProxyClientNotFound.classList.remove('hidden')
    }
  })

  ProxyClient.getConfig().then((data) => {
    if (data && Object.entries(data.configs).length > 0) {
      rksVPNBanner.classList.add('hidden')
      const proxyBlock = document.createElement('div')

      for (const [id, config] of Object.entries(data.configs)) {
        const protocol = config.protocol

        proxyBlock.className = 'proxy-list__block'
        proxyBlock.innerHTML = `
        <div class="radio-button proxy-list__block-item">
          <input class="radio-button-input" type="radio" name="local-proxy" id="${id}" value="${id}"/>
          <label class="radio-button-label" for="${id}">${protocol}</label>
          <div class="proxy-list__block-item__btn">
            <img src="../images/settings/more_icon.svg"/>
          </div>
        </div>`
        localProxyRadioList.append(proxyBlock)
      }
    } else {
      rksVPNBanner.classList.remove('hidden')
    }
  })

  const hideLocalProxyPopup = () => {
    addLocalProxyPopup.style.display = 'none'
  }

  const showLocalProxyPopup = () => {
    addLocalProxyPopup.style.display = 'block'
  }

  addLocalProxyButton.addEventListener('click', async () => {
    showLocalProxyPopup()
  })

  closeLocalProxyPopup.addEventListener('click', async () => {
    hideLocalProxyPopup()
  })

  goBackLocalProxy.addEventListener('click', async () => {
    hideLocalProxyPopup()
  })

  applyLocalProxyConfigButton.addEventListener('click', async () => {
    console.log('Config added...')
    hideLocalProxyPopup()
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
      localProxyOptions.style.display = 'block'
      addLocalProxyButton.style.display = 'inline-flex'
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
