import 'notyf/notyf.min.css'

import browser from 'Background/browser-api'
import ProxyClient from 'Background/localproxy'
import ProxyManager from 'Background/proxy'
import * as server from 'Background/server'
import { i18nGetMessage } from 'Background/utilities'
import { Notyf } from 'notyf'

(async () => {
  const notyf = new Notyf({
    duration: 2500,
    position: {
      x: 'center',
      y: 'bottom',
    },
    dismissible: true,
    ripple: false,
  })

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
  const moreAboutAmneziaPremiumLink = document.getElementById('moreAboutAmneziaPremiumLink')
  const whereToFindAddressLink = document.getElementById('whereToFindAddressLink')
  const localProxyClientNotFound = document.getElementById('localProxyClientNotFound')
  const localProxyLinksContainer = document.getElementById('localProxyLinksContainer')

  ProxyManager.isEnabled().then((isEnabled) => {
    useProxyCheckbox.checked = isEnabled
  })

  ProxyManager.alive().then((alive) => {
    proxyIsDown.hidden = alive
  })

  proxyCustomOptions.hidden = !proxyingEnabled

  moreAboutAmneziaPremiumLink.addEventListener('click', (e) => {
    e.preventDefault()
    window.open(i18nGetMessage('moreAboutAmneziaPremium'), '_blank')
  })

  whereToFindAddressLink.addEventListener('click', (e) => {
    e.preventDefault()
    window.open(i18nGetMessage('whereToFindAddressLink'), '_blank')
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

  const showLocalProxyWarning = () => {
    localProxyOptions.style.display = 'block'
    localProxyClientNotFound.classList.remove('hidden')
    localProxyLinksContainer.classList.remove('hidden')
  }

  const hideLocalProxyWarning = () => {
    localProxyOptions.style.display = 'none'
    localProxyClientNotFound.classList.add('hidden')
    localProxyLinksContainer.classList.add('hidden')
  }

  const syncLocalProxyState = async ({
    showSuccess = false,
    startIfMissing = false,
    forceApplyProxy = false,
  } = {}) => {
    if (!useLocalProxyRadioButton.checked) {
      return false
    }

    const isProxyEnabled = await ProxyManager.isEnabled()

    proxyOptionsInputs.classList.add('hidden')

    if (!isProxyEnabled) {
      return false
    }

    let proxyPort = await ProxyClient.ping(2500)

    if (!proxyPort && startIfMissing) {
      console.log('Trying to start AmneziaVPN in local proxy mode...')
      proxyPort = await ProxyClient.start(3000)
    }

    if (!proxyPort) {
      showLocalProxyWarning()
      return false
    }

    const nextLocalProxyURI = `127.0.0.1:${proxyPort || '10808'}`
    const { localProxyURI } = await browser.storage.local.get(['localProxyURI'])
    const shouldApplyProxy =
      forceApplyProxy || localProxyURI !== nextLocalProxyURI

    hideLocalProxyWarning()
    await ProxyClient.setLocalProxyURI(proxyPort)
    await ProxyManager.removeCustomProxy()
    await browser.storage.local.set({ useLocalProxy: true })

    if (shouldApplyProxy) {
      await ProxyManager.setProxy()
    }

    if (showSuccess) {
      notyf.success(i18nGetMessage('successLocalProxySet'))
    }

    return true
  }

  if (customProxyProtocol) {
    currentProxyProtocol.textContent = customProxyProtocol
  }

  if (useLocalProxy) {
    useLocalProxyRadioButton.checked = true
    await syncLocalProxyState({ forceApplyProxy: true })
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

    if (!customProxyServer) {
      proxyServerInput.classList.add('invalid-input')
      notyf.error(i18nGetMessage('errorProxyAddressEmpty'))
      return
    }

    // Validate port number
    // Format: hostname:port
    const parts = customProxyServer.split(':')
    const portString = parts[parts.length - 1]

    if (!portString || parts.length < 2) {
      proxyServerInput.classList.add('invalid-input')
      notyf.error(i18nGetMessage('errorProxyPortMissing'))
      return
    }

    const port = parseInt(portString, 10)

    if (isNaN(port) || port < 1 || port > 65535) {
      proxyServerInput.classList.add('invalid-input')
      notyf.error(i18nGetMessage('errorProxyPortInvalid', { port: portString }))
      return
    }

    const { useLocalProxy: usingLocalProxy } =
      await browser.storage.local.get({ useLocalProxy: false })

    await ProxyManager.removeLocalProxy()

    if (usingLocalProxy) {
      await ProxyClient.stop()
    }

    await browser.storage.local.set({
      useOwnProxy: true,
      customProxyProtocol: proxyProtocol,
      customProxyServerURI: customProxyServer,
    })

    await ProxyManager.setProxy()
    proxyServerInput.classList.remove('invalid-input')

    notyf.success(i18nGetMessage('successProxySaved', {
      protocol: proxyProtocol,
      server: customProxyServer,
    }))

    console.log(`Proxy host changed to: ${customProxyServer}`)
  })

  proxyCustomOptionsRadioGroup.addEventListener('change', async (event) => {
    const value = event.target.value

    if (value === 'default') {
      proxyOptionsInputs.classList.add('hidden')
      proxyServerInput.value = ''
      hideLocalProxyWarning()
      await server.synchronize({ syncRegistry: true, syncProxy: true })
      await ProxyManager.removeCustomProxy()
      await ProxyManager.removeLocalProxy()
      await ProxyManager.setProxy()
      await ProxyClient.stop()
      notyf.success(i18nGetMessage('successDefaultProxySet'))
    } else if (value === 'custom') {
      proxyOptionsInputs.classList.remove('hidden')
      hideLocalProxyWarning()
    } else if (value === 'local') {
      await syncLocalProxyState({
        showSuccess: true,
        startIfMissing: true,
        forceApplyProxy: true,
      })
    }
  })

  ProxyManager.controlledByThisExtension()
    .then(async (controlledByThisExtension) => {
      if (controlledByThisExtension) {
        useProxyCheckbox.checked = await ProxyManager.isEnabled()
        useProxyCheckbox.disabled = false
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

      if (useLocalProxyRadioButton.checked) {
        await syncLocalProxyState({
          showSuccess: true,
          startIfMissing: true,
          forceApplyProxy: true,
        })
      }
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

  setInterval(() => {
    syncLocalProxyState()
  }, 5000)
})()
