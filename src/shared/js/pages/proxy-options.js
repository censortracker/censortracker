import { sendConfigFetchMsg, sendExtensionCallMsg, sendTransitionMsg } from './messaging'

(async () => {
  const source = 'proxy-options'
  const SERVER_REGEX = /^(?:(?<username>[^:]+):(?<password>[^@]+)@)?(?<serverURI>[^:]+(?::\d+)?)$/

  const { useProxy: proxyingEnabled } = await sendConfigFetchMsg('useProxy')
  const proxyIsDown = document.getElementById('proxyIsDown')
  const proxyServerInput = document.getElementById('proxyServerInput')
  const saveCustomProxyButton = document.getElementById('saveCustomProxyButton')
  const useProxyCheckbox = document.getElementById('useProxyCheckbox')
  const proxyCustomOptions = document.getElementById('proxyCustomOptions')
  const proxyOptionsInputs = document.getElementById('proxyOptionsInputs')
  const useCustomProxyRadioButton = document.getElementById('useCustomProxy')
  const useDefaultProxyRadioButton = document.getElementById('useDefaultProxy')
  const usePremiumProxyRadioButton = document.getElementById('usePremiumProxy')
  const proxyCustomOptionsRadioGroup = document.getElementById(
    'proxyCustomOptionsRadioGroup',
  )
  const selectProxyProtocol = document.querySelector('.select')
  const currentProxyProtocol = document.querySelector('#select-toggle')
  const proxyProtocols = document.querySelectorAll('.select-option')

  sendConfigFetchMsg('proxyIsAlive').then(({ proxyIsAlive }) => {
    proxyIsDown.hidden = proxyIsAlive
  })

  proxyCustomOptions.hidden = !proxyingEnabled

  const {
    useOwnProxy,
    customProxyProtocol,
    customProxyServerURI,
    customProxyUsername,
    customProxyPassword,
    usePremiumProxy,
    haveActivePremiumConfig,
  } = await sendConfigFetchMsg(
    'useOwnProxy',
    'customProxyProtocol',
    'customProxyServerURI',
    'customProxyUsername',
    'customProxyPassword',
    'usePremiumProxy',
    'haveActivePremiumConfig',
  )

  if (customProxyProtocol) {
    currentProxyProtocol.textContent = customProxyProtocol
  }

  if (useOwnProxy) {
    proxyOptionsInputs.hidden = false
    useCustomProxyRadioButton.checked = true
    proxyOptionsInputs.classList.remove('hidden')

    const authPrefix = customProxyUsername && customProxyPassword ? (
      `${customProxyUsername}:${customProxyPassword}@`
    ) : ''

    proxyServerInput.value = authPrefix + customProxyServerURI
  } else if (usePremiumProxy) {
    usePremiumProxyRadioButton.checked = true
    proxyOptionsInputs.classList.add('hidden')
  } else {
    proxyOptionsInputs.classList.add('hidden')
    useDefaultProxyRadioButton.checked = true
  }

  saveCustomProxyButton.addEventListener('click', async (event) => {
    const customProxyServer = proxyServerInput.value
    const proxyProtocol = currentProxyProtocol.textContent.trim()
    const customProxyServerMatch = customProxyServer.match(SERVER_REGEX)

    if (customProxyServerMatch) {
      const { username, password, serverURI } = customProxyServerMatch.groups

      sendExtensionCallMsg(source, 'setCustomProxy',
        {
          proxyProtocol,
          customProxyServer: serverURI,
          username,
          password,
        })
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
      sendExtensionCallMsg(source, 'removeCustomProxy')
    } else if (event.target.value === 'custom') {
      proxyOptionsInputs.classList.remove('hidden')
    } else if (event.target.value === 'premium') {
      if (haveActivePremiumConfig) {
        sendExtensionCallMsg(source, 'activatePremiumProxy')
        proxyOptionsInputs.classList.add('hidden')
        usePremiumProxyRadioButton.checked = true
      } else {
        window.location.href = 'premium-proxy.html'
      }
    }
  })

  sendExtensionCallMsg('controlled', 'controlledByThisExtension')
    .then(async (controlledByThisExtension) => {
      if (controlledByThisExtension) {
        useProxyCheckbox.checked = true
        useProxyCheckbox.disabled = false

        if (!proxyingEnabled) {
          sendTransitionMsg('enableProxy')
        }
      }
    })
  sendExtensionCallMsg('controlled', 'controlledByOtherExtensions')
    .then(async (controlledByOtherExtensions) => {
      if (controlledByOtherExtensions) {
        useProxyCheckbox.checked = false
        useProxyCheckbox.disabled = true
        sendTransitionMsg('disableProxy')
      }
    })

  useProxyCheckbox.addEventListener('change', async () => {
    if (useProxyCheckbox.checked) {
      proxyCustomOptions.hidden = false
      useProxyCheckbox.checked = true
      sendTransitionMsg('enableProxy')
    } else {
      proxyCustomOptions.hidden = true
      useProxyCheckbox.checked = false
      proxyIsDown.hidden = true
      sendTransitionMsg('disableProxy')
    }
  }, false)

  useProxyCheckbox.checked = proxyingEnabled

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
