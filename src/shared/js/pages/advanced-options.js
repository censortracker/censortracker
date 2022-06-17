import Ignore from 'Background/ignore'
import ProxyManager from 'Background/proxy'
import Registry from 'Background/registry'
import Settings from 'Background/settings'
import * as storage from 'Background/storage'
import { choice, select } from 'Background/utilities'

(async () => {
  const debugInfoOkBtn = select({ id: 'debugInfoOk' })
  const showDebugInfo = select({ id: 'showDebugInfo' })
  const confirmResetBtn = select({ id: 'confirmReset' })
  const closeDebugInfoBtn = select({ id: 'closeDebugInfo' })
  const closePopupResetBtn = select({ id: 'closePopupReset' })
  const completedConfirmBtn = select({ id: 'completedConfirm' })
  const cancelPopupResetBtn = select({ id: 'cancelPopupReset' })
  const closePopupConfirmBtn = select({ id: 'closePopupConfirm' })
  const updateLocalRegistryBtn = select({ id: 'updateLocalRegistry' })
  const emergencyConfigCheckbox = select({ id: 'emergencyConfigCheckbox' })
  const resetSettingsToDefaultBtn = select({ id: 'resetSettingsToDefault' })
  const parentalControlCheckbox = select({ id: 'parentalControlCheckbox' })

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
      for (const popup of select({ cls: 'popup-show' })) {
        popup.classList.remove('popup-show')
      }
    }
  })

  showDebugInfo.addEventListener('click', async (event) => {
    const debugInfoJSON = document.getElementById('debugInfoJSON')
    const currentConfig = await Registry.getConfig({ debug: true })

    currentConfig.currentProxyURI = await ProxyManager.getProxyServerURI()
    debugInfoJSON.innerText = JSON.stringify(currentConfig)

    togglePopup('popupDebugInformation')
  })

  confirmResetBtn.addEventListener('click', async (event) => {
    togglePopup('popupConfirmReset')
    togglePopup('popupCompletedSuccessfully')
    await Ignore.clear()
    await Registry.sync()
    await ProxyManager.setProxy()
    await Settings.enableExtension()
    console.warn('Censor Tracker has been reset to default settings.')
  })
})()
