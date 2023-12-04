import Browser, { getBrowserInfo } from 'Background/browser-api'
import ProxyManager from 'Background/proxy'
import * as server from 'Background/server'
import Settings from 'Background/settings'

(async () => {
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
    event.target.innerHTML = '&check;'

    setTimeout(() => {
      togglePopup('popupDebugInformation')
    }, 500)
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
    ProxyManager.isEnabled().then(async (proxyingEnabled) => {
      await server.synchronize()

      if (proxyingEnabled) {
        await ProxyManager.removeBadProxies()
        await ProxyManager.setProxy()
        await ProxyManager.ping()
      } else {
        console.warn('Registry updated, but proxying is disabled.')
      }
    })
  })

  document.addEventListener('keydown', async (event) => {
    if (event.key === 'Escape') {
      for (const popup of document.getElementsByClassName('popup-show')) {
        popup.classList.remove('popup-show')
      }
    }
  })

  showDebugInfoBtn.addEventListener('click', async (event) => {
    const thisExtension = await Browser.management.getSelf()
    const extensionsInfo = await Browser.management.getAll()
    const { version: currentVersion } = Browser.runtime.getManifest()

    const {
      localConfig = {},
      fallbackReason,
      fallbackProxyInUse = false,
      fallbackProxyError,
      proxyLastFetchTs,
    } = await Browser.storage.local.get([
      'localConfig',
      'fallbackReason',
      'fallbackProxyInUse',
      'fallbackProxyError',
      'proxyLastFetchTs',
    ])

    if (extensionsInfo.length > 0) {
      localConfig.conflictingExtensions = extensionsInfo
        .filter(({ name }) => name !== thisExtension.name)
        .filter(({ enabled, permissions = [] }) =>
          permissions.includes('proxy') && enabled)
        .map(({ name }) => name.split(' - ')[0])
    }

    localConfig.version = currentVersion

    if (fallbackProxyInUse) {
      localConfig.fallbackReason = fallbackReason
      localConfig.fallbackProxyError = fallbackProxyError
      localConfig.fallbackProxyInUse = fallbackProxyInUse
    }
    localConfig.browser = getBrowserInfo()
    localConfig.proxyLastFetchTs = proxyLastFetchTs
    localConfig.badProxies = await ProxyManager.getBadProxies()
    localConfig.currentProxyURI = await ProxyManager.getProxyingRules()
    localConfig.proxyControlled = await ProxyManager.controlledByThisExtension()
    debugInfoJSON.textContent = JSON.stringify(localConfig, null, 2)
    togglePopup('popupDebugInformation')
  })

  confirmResetBtn.addEventListener('click', async (event) => {
    togglePopup('popupConfirmReset')
    togglePopup('popupCompletedSuccessfully')
    await server.synchronize()
    await Settings.enableExtension()
    await Settings.enableNotifications()
    await Settings.disableParentalControl()
    await ProxyManager.removeBadProxies()
    await ProxyManager.setProxy()
    await ProxyManager.ping()
    console.warn('Censor Tracker has been reset to default settings.')
  })

  exportSettingsBtn.addEventListener('click', (event) => {
    Settings.exportSettings().then((settings) => {
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

      await Settings.importSettings(data)

      // Render new state
      window.location.reload()

      await server.synchronize({ syncRegistry: true })
      await ProxyManager.setProxy()
      await ProxyManager.ping()
    })
    fileReader.readAsText(file)
  })
})()
