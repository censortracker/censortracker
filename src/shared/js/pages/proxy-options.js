import { countDays } from '../utilities'
import { sendConfigFetchMsg, sendExtensionCallMsg, sendTransitionMsg } from './messaging'

(async () => {
  const source = 'proxy-options'
  const SERVER_REGEX = /^(?:(?<username>[^:]+):(?<password>[^@]+)@)?(?<serverURI>[^:]+(?::\d+)?)$/

  const { useProxy: proxyingEnabled } = await sendConfigFetchMsg('useProxy')
  const proxyIsDown = document.getElementById('proxyIsDown')
  const proxyServerInput = document.getElementById('proxyServerInput')
  const saveCustomProxyButton = document.getElementById('saveCustomProxyButton')
  const savePremiumProxyButton = document.getElementById('savePremiumProxyButton')
  const useProxyCheckbox = document.getElementById('useProxyCheckbox')
  const proxyCustomOptions = document.getElementById('proxyCustomOptions')
  const proxyOptionsInputs = document.getElementById('proxyOptionsInputs')
  const proxyPremiumForm = document.getElementById('proxyPremiumForm')
  const premiumProxyData = document.getElementById('premiumProxyData')
  const premiumExpirationDateLabel = document.getElementById('days-to-expiration-label')
  const premiumIdentificationCodeLabel = document.getElementById('identification-code-label')
  const proxyPremiumInput = document.getElementById('proxyPremiumInput')
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
    premiumIdentificationCode,
    premiumExpirationDate,
  } = await sendConfigFetchMsg(
    'useOwnProxy',
    'customProxyProtocol',
    'customProxyServerURI',
    'customProxyUsername',
    'customProxyPassword',
    'usePremiumProxy',
    'premiumIdentificationCode',
    'premiumExpirationDate',
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
    proxyPremiumForm.classList.remove('hidden')
    premiumProxyData.classList.remove('hidden')
    premiumIdentificationCodeLabel.textContent = premiumIdentificationCode
    premiumExpirationDateLabel.textContent = countDays(Date.now(), premiumExpirationDate)
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
      proxyPremiumForm.classList.add('hidden')
      proxyServerInput.value = ''
      sendExtensionCallMsg(source, 'removeCustomProxy')
    } else if (event.target.value === 'custom') {
      proxyOptionsInputs.classList.remove('hidden')
      proxyPremiumForm.classList.add('hidden')
      proxyPremiumInput.value = ''
    } else if (event.target.value === 'premium') {
      proxyOptionsInputs.classList.add('hidden')
      proxyPremiumForm.classList.remove('hidden')
      proxyServerInput.value = ''
    }
  })

  savePremiumProxyButton.addEventListener('click', async (event) => {
    const encodedPremiumData = proxyPremiumInput.value

    premiumProxyData.classList.add('hidden')
    if (encodedPremiumData) {
      const { res, err } = await sendExtensionCallMsg(source, 'setPremiumProxy',
        {
          configString: encodedPremiumData,
        },
      )

      if (err) {
        console.log(err)
        proxyPremiumInput.classList.add('invalid-input')
      } else {
        premiumProxyData.classList.remove('hidden')
        const { premiumIdentificationCode: idCode, premiumExpirationDate: expDate } = res

        premiumIdentificationCodeLabel.textContent = idCode
        premiumExpirationDateLabel.textContent = countDays(Date.now(), expDate)

        proxyPremiumInput.classList.remove('invalid-input')
      }
    } else {
      proxyPremiumInput.classList.add('invalid-input')
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
