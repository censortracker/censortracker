import browser from '../browser-api'
import { countDays } from '../utilities'
import { sendConfigFetchMsg, sendExtensionCallMsg/*, sendTransitionMsg */ } from './messaging'

(async () => {
  const {
    usePremiumProxy,
    premiumIdentificationCode,
    premiumExpirationDate,
    // haveActivePremiumConfig,
  } = await sendConfigFetchMsg(
    'usePremiumProxy',
    'haveActivePremiumConfig',
    'premiumIdentificationCode',
    'premiumExpirationDate',
  )

  const premiumProxyStatus = document.getElementById('premiumProxyStatus')

  const activePremiumData = document.getElementById('activePremiumData')
  const premiumProxyExpirationDate = document.getElementById('premiumProxyExpirationDate')
  const premiumProxyDaysLeft = document.getElementById('premiumProxyDaysLeft')
  const premiumProxyPersonalCode = document.getElementById('premiumProxyPersonalCode')
  const premiumProxyError = document.getElementById('premiumProxyError')
  const proxyPremiumInput = document.getElementById('proxyPremiumInput')
  const savePremiumProxyButton = document.getElementById('savePremiumProxyButton')
  const updatePremiumProxyConfig = document.getElementById('updatePremiumProxyConfig')

  const premiumPurchaseData = document.getElementById('premiumPurchaseData')
  const premiumPurchaseRow = document.getElementById('premiumPurchaseRow')
  const premiumInputCard = document.getElementById('premiumInputCard')
  const premiumCodeInputTitle = document.getElementById('premiumCodeInputTitle')

  premiumProxyStatus.textContent = browser.i18n.getMessage(
    usePremiumProxy ? 'premiumProxyStatusTurnedOn' : 'premiumProxyStatusTurnedOff',
  )

  proxyPremiumInput.placeholder = browser.i18n.getMessage('premiumCodeInputPlaceholder')

  if (usePremiumProxy) {
    activePremiumData.classList.remove('hidden')
    updatePremiumProxyConfig.classList.remove('hidden')
    premiumProxyExpirationDate.textContent = new Date(premiumExpirationDate).toLocaleDateString('ru-RU')
    premiumProxyDaysLeft.textContent = countDays(Date.now(), premiumExpirationDate)
    premiumProxyPersonalCode.textContent = premiumIdentificationCode
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
        premiumProxyError.classList.remove('hidden')
        premiumProxyError.textContent = browser.i18n.getMessage(err)
      } else {
        premiumProxyError.classList.add('hidden')
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
      }
    } else {
      proxyPremiumInput.classList.add('invalid-input')
    }
  })

  updatePremiumProxyConfig.addEventListener('click', async (_event) => {
    updatePremiumProxyConfig.classList.add('hidden')
    premiumInputCard.classList.remove('hidden')
    premiumCodeInputTitle.textContent = browser.i18n.getMessage('premiumCodeInputUpdate')
  })
})()
