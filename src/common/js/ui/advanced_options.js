import { ignore, proxy, registry, settings, translateDocument } from '@/common/js'

(async () => {
  translateDocument(document)
  const btnConfirmOk = document.getElementById('confirmOk')
  const btnConfirmReset = document.getElementById('confirmReset')
  const btnClosePopupReset = document.getElementById('closePopupReset')
  const popupConfirmReset = document.getElementById('popupConfirmReset')
  const btnCancelPopupReset = document.getElementById('cancelPopupReset')
  const closeDebugInfo = document.getElementById('closeDebugInfo')
  const okDebugInfo = document.getElementById('okDebugInfo')
  const btnClosePopupConfirm = document.getElementById('closePopupConfirm')
  const updateLocalRegistry = document.getElementById('updateLocalRegistry')
  const resetSettingsToDefault = document.getElementById('resetSettingsToDefault')
  const popupDebugInformation = document.getElementById('popupDebugInformation')
  const popupCompletedSuccessfully = document.getElementById('popupCompletedSuccessfully')

  const showPopupClass = 'popup_show'

  const toggleCompletedPopup = () => {
    if (popupCompletedSuccessfully.classList.contains(showPopupClass)) {
      popupCompletedSuccessfully.classList.remove(showPopupClass)
    } else {
      popupCompletedSuccessfully.classList.add(showPopupClass)
    }
  }

  const toggleResetPopup = () => {
    if (popupConfirmReset.classList.contains(showPopupClass)) {
      popupConfirmReset.classList.remove(showPopupClass)
    } else {
      popupConfirmReset.classList.add(showPopupClass)
    }
  }

  const toggleDebugInfoPopup = () => {
    if (popupDebugInformation.classList.contains(showPopupClass)) {
      popupDebugInformation.classList.remove(showPopupClass)
    } else {
      popupDebugInformation.classList.add(showPopupClass)
    }
  }

  document.addEventListener('keydown', async (event) => {
    if (event.ctrlKey && event.key === 'd') {
      const debugInfoJSON = document.getElementById('debugInfoJSON')
      const currentConfig = await registry.getConfig()

      currentConfig.currentProxyURI = await proxy.getProxyServerURI()
      debugInfoJSON.innerText = JSON.stringify(currentConfig, undefined, 4)

      toggleDebugInfoPopup()
    }
    event.preventDefault()
  })

  okDebugInfo.addEventListener('click', (event) => {
    toggleDebugInfoPopup()
  })

  closeDebugInfo.addEventListener('click', (event) => {
    toggleDebugInfoPopup()
  })

  resetSettingsToDefault.addEventListener('click', (event) => {
    toggleResetPopup()
  })
  btnClosePopupReset.addEventListener('click', (event) => {
    toggleResetPopup()
  })
  btnCancelPopupReset.addEventListener('click', (event) => {
    toggleResetPopup()
  })
  btnClosePopupConfirm.addEventListener('click', (event) => {
    toggleCompletedPopup()
  })

  btnConfirmOk.addEventListener('click', (event) => {
    toggleCompletedPopup()
  })

  updateLocalRegistry.addEventListener('click', async (event) => {
    const synced = await registry.sync()

    if (synced) {
      await proxy.setProxy()
      toggleCompletedPopup()
    } else {
      console.error('Error on syncing database')
      toggleCompletedPopup()
    }
  })

  btnConfirmReset.addEventListener('click', async (event) => {
    await ignore.clear()
    await registry.clear()
    await registry.sync()
    await proxy.setProxy()
    await settings.enableExtension()
    await settings.disableDPIDetection()
    toggleResetPopup()
    toggleCompletedPopup()
    console.warn('CensorTracker has been reset to default settings.')
  })
})()
