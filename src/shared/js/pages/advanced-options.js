import ProxyManager from 'Background/proxy'
import Registry from 'Background/registry'
import Settings from 'Background/settings'
import * as storage from 'Background/storage'
import { choice } from 'Background/utilities'
import Browser from 'Background/webextension'

(async () => {
  const debugInfoOkBtn = document.getElementById('debugInfoOk')
  const showDebugInfo = document.getElementById('showDebugInfo')
  const confirmResetBtn = document.getElementById('confirmReset')
  const closeDebugInfoBtn = document.getElementById('closeDebugInfo')
  const closePopupResetBtn = document.getElementById('closePopupReset')
  const completedConfirmBtn = document.getElementById('completedConfirm')
  const cancelPopupResetBtn = document.getElementById('cancelPopupReset')
  const closePopupConfirmBtn = document.getElementById('closePopupConfirm')
  const updateLocalRegistryBtn = document.getElementById('updateLocalRegistry')
  const emergencyConfigCheckbox = document.getElementById('emergencyConfigCheckbox')
  const resetSettingsToDefaultBtn = document.getElementById('resetSettingsToDefault')
  const parentalControlCheckbox = document.getElementById('parentalControlCheckbox')

  const fetchEmergencyAPIEndpoints = async () => {
    const apiURL = choice([
      'https://censortracker.netlify.app/',
      'https://roskomsvoboda.github.io/ctconf/endpoints.json',
    ])

    try {
      const response = await fetch(apiURL)

      return await response.json()
    } catch (error) {
      console.error('Error on fetching emergency API endpoints:', error)
      return {}
    }
  }

  storage.get({
    emergencyMode: false,
    parentalControl: false,
  }).then(({ emergencyMode, parentalControl }) => {
    emergencyConfigCheckbox.checked = emergencyMode
    parentalControlCheckbox.checked = parentalControl
  })

  emergencyConfigCheckbox.addEventListener('change', async (event) => {
    const emergencyMode = event.target.checked

    if (emergencyMode) {
      const {
        proxy: proxyAPIEndpoint,
        ignore: ignoreAPIEndpoint,
        registry: registryAPIEndpoint,
      } = await fetchEmergencyAPIEndpoints()

      if (ignoreAPIEndpoint && proxyAPIEndpoint && registryAPIEndpoint) {
        await storage.set({
          emergencyMode: true,
          proxyAPIEndpoint,
          ignoreAPIEndpoint,
          registryAPIEndpoint,
        })
      } else {
        console.error('Failed to fetch emergency API endpoints')
      }
    } else {
      await storage.set({ emergencyMode: false })
      await storage.remove([
        'proxyAPIEndpoint',
        'ignoreAPIEndpoint',
        'registryAPIEndpoint',
      ])
    }
    console.log(`Emergency mode: ${emergencyMode}`)
  }, false)

  parentalControlCheckbox.addEventListener('change', async (event) => {
    await storage.set({ parentalControl: event.target.checked })
    console.log(`Parental control: ${event.target.checked}`)
  }, false)

  const togglePopup = (id) => {
    const showPopupClass = 'popup-show'
    const popup = document.getElementById(id)

    if (popup) {
      if (popup.classList.contains(showPopupClass)) {
        popup.classList.remove(showPopupClass)
      } else {
        popup.classList.add(showPopupClass)
      }
    } else {
      console.error('Nothing to toggle.')
    }
  }

  debugInfoOkBtn.addEventListener('click', (event) => {
    togglePopup('popupDebugInformation')
  })
  closeDebugInfoBtn.addEventListener('click', (event) => {
    togglePopup('popupDebugInformation')
  })
  resetSettingsToDefaultBtn.addEventListener('click', (event) => {
    togglePopup('popupConfirmReset')
  })
  closePopupResetBtn.addEventListener('click', (event) => {
    togglePopup('popupConfirmReset')
  })
  cancelPopupResetBtn.addEventListener('click', (event) => {
    togglePopup('popupConfirmReset')
  })
  closePopupConfirmBtn.addEventListener('click', (event) => {
    togglePopup('popupCompletedSuccessfully')
  })
  completedConfirmBtn.addEventListener('click', (event) => {
    togglePopup('popupCompletedSuccessfully')
  })

  updateLocalRegistryBtn.addEventListener('click', async (event) => {
    togglePopup('popupCompletedSuccessfully')
    const synced = await Registry.sync()

    if (synced) {
      await ProxyManager.setProxy()
    } else {
      console.error('Error on syncing database')
    }
  })

  document.addEventListener('keydown', async (event) => {
    if (event.key === 'Escape') {
      for (const popup of document.getElementsByClassName('popup-show')) {
        popup.classList.remove('popup-show')
      }
    }
  })

  showDebugInfo.addEventListener('click', async (event) => {
    const debugInfoJSON = document.getElementById('debugInfoJSON')
    const thisExtension = await Browser.management.getSelf()
    const currentConfig = await Registry.getCurrentConfig()
    const extensionsInfo = await Browser.management.getAll()

    if (extensionsInfo.length > 0) {
      currentConfig.conflictingExtensions = extensionsInfo
        .filter(({ name }) => name !== thisExtension.name)
        .filter(({ enabled, permissions }) => permissions.includes('proxy') && enabled)
        .map(({ name }) => name.split(' - ')[0])
    }

    currentConfig.currentProxyURI = await ProxyManager.getProxyServerURI()
    currentConfig.proxyControlled = await ProxyManager.controlledByThisExtension()
    debugInfoJSON.textContent = JSON.stringify(currentConfig, null, 2)
    togglePopup('popupDebugInformation')
  })

  confirmResetBtn.addEventListener('click', async (event) => {
    togglePopup('popupConfirmReset')
    togglePopup('popupCompletedSuccessfully')
    await Registry.sync()
    await ProxyManager.setProxy()
    await Settings.enableExtension()
    console.warn('Censor Tracker has been reset to default settings.')
  })
})()
