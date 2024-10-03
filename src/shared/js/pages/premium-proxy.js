import browser from '../browser-api'
import { countDays } from '../utilities'
import { sendConfigFetchMsg, sendExtensionCallMsg/*, sendTransitionMsg */ } from './messaging'

(async () => {
  const {
    usePremiumProxy,
    premiumIdentificationCode,
    premiumExpirationDate,
    haveActivePremiumConfig,
  } = await sendConfigFetchMsg(
    'usePremiumProxy',
    'haveActivePremiumConfig',
    'premiumIdentificationCode',
    'premiumExpirationDate',
    'haveActivePremiumConfig',
  )

  const premiumProxyStatus = document.getElementById('premiumProxyStatus')

  const activePremiumData = document.getElementById('activePremiumData')
  const premiumProxyExpirationDate = document.getElementById('premiumProxyExpirationDate')
  const premiumProxyDaysLeft = document.getElementById('premiumProxyDaysLeft')
  const premiumProxyPersonalCode = document.getElementById('premiumProxyPersonalCode')
  const premiumProxyEnableError = document.getElementById('premiumProxyEnableError')
  const premiumProxyInputError = document.getElementById('premiumProxyInputError')
  const proxyPremiumInput = document.getElementById('proxyPremiumInput')
  const savePremiumProxyButton = document.getElementById('savePremiumProxyButton')

  const updatePremiumProxyConfig = document.getElementById('updatePremiumProxyConfig')
  const disablePremiumProxy = document.getElementById('disablePremiumProxy')
  const disablePremiumProxyDetails = document.getElementById('disablePremiumProxyDetails')
  const disablePremiumProxyCancel = document.getElementById('disablePremiumProxyCancel')
  const disablePremiumProxyApprove = document.getElementById('disablePremiumProxyApprove')

  const enablePremiumProxy = document.getElementById('enablePremiumProxy')

  const premiumPurchaseData = document.getElementById('premiumPurchaseData')
  const premiumPurchaseRow = document.getElementById('premiumPurchaseRow')
  const premiumInputCard = document.getElementById('premiumInputCard')
  const premiumCodeInputTitle = document.getElementById('premiumCodeInputTitle')

  let statusHeaderMessage

  if (!haveActivePremiumConfig) {
    statusHeaderMessage = 'premiumProxyStatusNotActivated'
  } else {
    statusHeaderMessage = usePremiumProxy ? 'premiumProxyStatusTurnedOn' : 'premiumProxyStatusTurnedOff'
  }
  premiumProxyStatus.textContent = browser.i18n.getMessage(statusHeaderMessage)

  proxyPremiumInput.placeholder = browser.i18n.getMessage('premiumCodeInputPlaceholder')

  if (haveActivePremiumConfig) {
    activePremiumData.classList.remove('hidden')
    premiumProxyExpirationDate.textContent = new Date(premiumExpirationDate).toLocaleDateString('ru-RU')
    premiumProxyPersonalCode.textContent = premiumIdentificationCode
    premiumProxyDaysLeft.textContent = countDays(Date.now(), premiumExpirationDate)

    if (usePremiumProxy) {
      updatePremiumProxyConfig.classList.remove('hidden')
      disablePremiumProxy.classList.remove('hidden')
    } else {
      enablePremiumProxy.classList.remove('hidden')
    }
  } else {
    premiumPurchaseData.classList.remove('hidden')
    premiumPurchaseRow.classList.remove('hidden')
    premiumInputCard.classList.remove('hidden')
  }

  savePremiumProxyButton.addEventListener('click', async (event) => {
    const encodedPremiumData = proxyPremiumInput.value

    if (encodedPremiumData) {
      const { res, err } = await sendExtensionCallMsg('proxy-options', 'setPremiumProxy',
        {
          configString: encodedPremiumData,
        },
      )

      if (err) {
        proxyPremiumInput.classList.add('invalid-input')
        premiumProxyInputError.classList.remove('hidden')
        premiumProxyInputError.textContent = browser.i18n.getMessage(err)
      } else {
        premiumProxyInputError.classList.add('hidden')
        const {
          premiumIdentificationCode: idCode,
          premiumExpirationDate: expDate,
        } = res

        activePremiumData.classList.remove('hidden')
        updatePremiumProxyConfig.classList.remove('hidden')
        premiumPurchaseData.classList.add('hidden')
        premiumPurchaseRow.classList.add('hidden')
        premiumInputCard.classList.add('hidden')

        premiumProxyPersonalCode.textContent = idCode
        premiumProxyExpirationDate.textContent = new Date(expDate).toLocaleDateString('ru-RU')
        premiumProxyDaysLeft.textContent = countDays(Date.now(), expDate)

        proxyPremiumInput.classList.remove('invalid-input')
        updatePremiumProxyConfig.classList.remove('hidden')
        disablePremiumProxy.classList.remove('hidden')
      }
    } else {
      proxyPremiumInput.classList.add('invalid-input')
    }
  })

  updatePremiumProxyConfig.addEventListener('click', async (_event) => {
    updatePremiumProxyConfig.classList.add('hidden')
    disablePremiumProxy.classList.add('hidden')
    premiumInputCard.classList.remove('hidden')
    premiumCodeInputTitle.textContent = browser.i18n.getMessage('premiumCodeInputUpdate')
  })

  disablePremiumProxy.addEventListener('click', async (_event) => {
    updatePremiumProxyConfig.classList.add('hidden')
    disablePremiumProxy.classList.add('hidden')
    disablePremiumProxyDetails.classList.remove('hidden')
  })

  disablePremiumProxyCancel.addEventListener('click', async (_event) => {
    updatePremiumProxyConfig.classList.remove('hidden')
    disablePremiumProxy.classList.remove('hidden')
    disablePremiumProxyDetails.classList.add('hidden')
  })

  disablePremiumProxyApprove.addEventListener('click', async (_event) => {
    await sendExtensionCallMsg('proxy-options', 'disablePremiumProxy')
    window.location.reload()
  })

  enablePremiumProxy.addEventListener('click', async (_event) => {
    const { hasNotExpired } = await sendExtensionCallMsg('proxy-options', 'enablePremiumProxy')

    console.log(hasNotExpired)

    if (hasNotExpired) {
      window.location.reload()
    } else {
      premiumProxyEnableError.classList.remove('hidden')
      setTimeout(() => {
        window.location.reload()
      }, 3000)
    }
  })
})()
