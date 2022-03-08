import { ignore, proxy, registry, settings, translateDocument } from '@/common/js'

(async () => {
  translateDocument(document)
  const btnConfirmOk = document.getElementById('confirmOk')
  const btnConfirmReset = document.getElementById('confirmReset')
  const btnClosePopupReset = document.getElementById('closePopupReset')
  const popupConfirmReset = document.getElementById('popupConfirmReset')
  const popupNotification = document.getElementById('popupNotification')
  const btnCancelPopupReset = document.getElementById('cancelPopupReset')
  const btnClosePopupConfirm = document.getElementById('closePopupConfirm')
  const updateLocalRegistry = document.getElementById('updateLocalRegistry')
  const resetSettingsToDefault = document.getElementById('resetSettingsToDefault')

  resetSettingsToDefault.addEventListener('click', (event) => {
    popupConfirmReset.classList.add('popup_show')
  })
  btnClosePopupReset.addEventListener('click', (event) => {
    popupConfirmReset.classList.remove('popup_show')
  })
  btnCancelPopupReset.addEventListener('click', (event) => {
    popupConfirmReset.classList.remove('popup_show')
  })
  btnClosePopupConfirm.addEventListener('click', (event) => {
    popupNotification.classList.remove('popup_show')
  })
  btnConfirmOk.addEventListener('click', (event) => {
    popupNotification.classList.remove('popup_show')
  })

  updateLocalRegistry.addEventListener('click', async (event) => {
    await registry.sync()
    await proxy.setProxy()
    toastr.info('Are you the 6 fingered man?')
    window.reload()
  })

  btnConfirmReset.addEventListener('click', async (event) => {
    await settings.enableExtension()
    await settings.disableDPIDetection()
    await ignore.clear()
    await registry.clear()
    await registry.sync()
    await proxy.setProxy()
    popupNotification.classList.add('popup_show')
    popupConfirmReset.classList.remove('popup_show')
    window.reload()

    console.warn('CensorTracker has been reset to default settings.')
  })
})()
