import {
  ignore,
  proxy,
  registry,
  settings,
  translateDocument,
} from '@/common/scripts';

(async () => {
  translateDocument(document)
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
    const synced = await registry.sync()

    if (synced) {
      await proxy.setProxy()
      togglePopup('popupCompletedSuccessfully')
    } else {
      console.error('Error on syncing database')
      togglePopup('popupCompletedSuccessfully')
    }
  })

  document.addEventListener('keydown', async (event) => {
    if (event.ctrlKey && event.key === 'd') {
      const debugInfoJSON = document.getElementById('debugInfoJSON')
      const currentConfig = await registry.getConfig()

      currentConfig.currentProxyURI = await proxy.getProxyServerURI()
      debugInfoJSON.innerText = JSON.stringify(currentConfig, undefined, 4)

      togglePopup('popupDebugInformation')
      event.preventDefault()
    }
  })

  confirmResetBtn.addEventListener('click', async (event) => {
    await ignore.clear()
    await registry.clear()
    await registry.sync()
    await proxy.setProxy()
    await settings.enableExtension()
    await settings.disableDPIDetection()
    togglePopup('popupConfirmReset')
    togglePopup('popupCompletedSuccessfully')
    console.warn('CensorTracker has been reset to default settings.')
  })
})()
