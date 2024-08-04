import { sendExtensionCallMsg, sendTransitionMsg } from './messaging'

(async () => {
  const source = 'advanced-options'
  const debugInfoJSON = document.getElementById('debugInfoJSON')
  const showDebugInfoBtn = document.getElementById('showDebugInfo')
  const confirmResetBtn = document.getElementById('confirmReset')
  const closeDebugInfoBtn = document.getElementById('closeDebugInfo')
  const copyDebugInfoBtn = document.getElementById('copyDebugInfoBtn')
  const closePopupResetBtn = document.getElementById('closePopupReset')
  const completedConfirmBtn = document.getElementById('completedConfirm')
  const cancelPopupResetBtn = document.getElementById('cancelPopupReset')
  const closePopupConfirmBtn = document.getElementById('closePopupConfirm')
  const updateLocalRegistryBtn = document.getElementById('updateLocalRegistry')
  const resetSettingsToDefaultBtn = document.getElementById('resetSettingsToDefault')
  const exportSettingsBtn = document.getElementById('exportSettings')
  const importSettingsInput = document.getElementById('importSettingsInput')

  let shouldToggle = false

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

  copyDebugInfoBtn.addEventListener('click', (event) => {
    debugInfoJSON.select()
    document.execCommand('copy')
    if (shouldToggle) {
      setTimeout(() => {
        togglePopup('popupDebugInformation')
      }, 500)
      return
    }
    shouldToggle = true
    event.target.innerHTML = '&check;'
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
    sendTransitionMsg('updateRegistry')
  })

  document.addEventListener('keydown', async (event) => {
    if (event.key === 'Escape') {
      for (const popup of document.getElementsByClassName('popup-show')) {
        popup.classList.remove('popup-show')
      }
    }
  })

  showDebugInfoBtn.addEventListener('click', async (event) => {
    const debugInfo = await sendExtensionCallMsg(source, 'getDebugInfo')

    debugInfoJSON.textContent = JSON.stringify(debugInfo, null, 2)
    togglePopup('popupDebugInformation')
  })

  confirmResetBtn.addEventListener('click', async (event) => {
    togglePopup('popupConfirmReset')
    togglePopup('popupCompletedSuccessfully')
    sendTransitionMsg('resetExtension')
  })

  exportSettingsBtn.addEventListener('click', (event) => {
    sendExtensionCallMsg(source, 'exportSettings').then((settings) => {
      const data = JSON.stringify(settings, null, 2)
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')

      link.href = url
      link.download = 'censortracker.settings.json'

      link.style.display = 'none'
      document.body.append(link)

      link.click()

      document.body.removeChild(link)
      URL.revokeObjectURL(url)
    })
  })

  importSettingsInput.addEventListener('change', async (event) => {
    const file = event.target.files[0]
    const fileReader = new FileReader()

    fileReader.addEventListener('load', async (e) => {
      const contents = e.target.result
      const data = JSON.parse(contents)

      await sendTransitionMsg('importSettings', { settings: data })
      // Render new state
      window.location.reload()
    })
    fileReader.readAsText(file)
  })
})()
