import Ignore from 'Background/ignore'
import ProxyManager from 'Background/proxy'
import Registry from 'Background/registry'
import Settings from 'Background/settings'
import * as storage from 'Background/storage'

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

  await storage.get({ parentalControl: false, emergencyMode: false })
    .then(({ emergencyMode, parentalControl }) => {
      emergencyConfigCheckbox.checked = emergencyMode
      parentalControlCheckbox.checked = parentalControl
    })

  emergencyConfigCheckbox.addEventListener('change', async (event) => {
    await storage.set({ emergencyMode: event.target.checked })
    console.log(`Emergency mode: ${event.target.checked}`)
  }, false)

  parentalControlCheckbox.addEventListener('change', async (event) => {
    await storage.set({ parentalControl: event.target.checked })
    console.log(`Parental control: ${event.target.checked}`)
  }, false)

  const togglePopup = (id) => {
    const showPopupClass = 'popup_show'
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
    console.warn('CensorTracker has been reset to default settings.')
  })
})()
