import Ignore from '@/shared/scripts/ignore'
import ProxyManager from '@/shared/scripts/proxy'
import Registry from '@/shared/scripts/registry'
import Settings from '@/shared/scripts/settings'

(async () => {
  const completedConfirmBtn = document.getElementById('completedConfirm')
  const debugInfoOkBtn = document.getElementById('debugInfoOk')
  const confirmResetBtn = document.getElementById('confirmReset')
  const closeDebugInfoBtn = document.getElementById('closeDebugInfo')
  const closePopupResetBtn = document.getElementById('closePopupReset')
  const cancelPopupResetBtn = document.getElementById('cancelPopupReset')
  const closePopupConfirmBtn = document.getElementById('closePopupConfirm')
  const updateLocalRegistryBtn = document.getElementById('updateLocalRegistry')
  const resetSettingsToDefaultBtn = document.getElementById(
    'resetSettingsToDefault',
  )

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

  document.addEventListener('keydown', async (event) => {
    if (event.ctrlKey && event.key === 'd') {
      const debugInfoJSON = document.getElementById('debugInfoJSON')
      const currentConfig = await Registry.getConfig()

      currentConfig.currentProxyURI = await ProxyManager.getProxyServerURI()
      debugInfoJSON.innerText = JSON.stringify(currentConfig, undefined, 4)

      togglePopup('popupDebugInformation')
      event.preventDefault()
    }
  })

  confirmResetBtn.addEventListener('click', async (event) => {
    togglePopup('popupConfirmReset')
    togglePopup('popupCompletedSuccessfully')
    await Ignore.clear()
    await Registry.clear()
    await Registry.sync()
    await ProxyManager.setProxy()
    await Settings.enableExtension()
    console.warn('CensorTracker has been reset to default settings.')
  })
})()
