import browser, { getBrowserInfo } from 'Background/browser-api'
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
  const useCustomRegistryCheckbox = document.getElementById('useCustomRegistryCheckbox')
  const customRegistryUrlInput = document.getElementById('customRegistryUrlInput')
  const saveCustomRegistryButton = document.getElementById('saveCustomRegistryButton')
  const customRegistryStatus = document.getElementById('customRegistryStatus')

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

  // --- Custom (alternative) registry source ----------------------------------
  if (useCustomRegistryCheckbox && customRegistryUrlInput && saveCustomRegistryButton) {
    browser.storage.local.get({
      useCustomRegistry: false,
      customRegistryUrl: '',
    }).then(({ useCustomRegistry, customRegistryUrl }) => {
      useCustomRegistryCheckbox.checked = useCustomRegistry
      customRegistryUrlInput.value = customRegistryUrl
    })

    const flashRegistryStatus = (key, isError = false) => {
      customRegistryStatus.textContent = browser.i18n.getMessage(key)
      customRegistryStatus.classList.remove('hidden')
      customRegistryStatus.style.color = isError ? '#c0392b' : ''
      setTimeout(() => {
        customRegistryStatus.classList.add('hidden')
      }, 6000)
    }

    useCustomRegistryCheckbox.addEventListener('change', async () => {
      await browser.storage.local.set({
        useCustomRegistry: useCustomRegistryCheckbox.checked,
      })
    })

    saveCustomRegistryButton.addEventListener('click', async () => {
      const url = customRegistryUrlInput.value.trim()

      if (useCustomRegistryCheckbox.checked && !/^https?:\/\//i.test(url)) {
        flashRegistryStatus('customRegistryInvalid', true)
        return
      }

      await browser.storage.local.set({
        customRegistryUrl: url,
        useCustomRegistry: useCustomRegistryCheckbox.checked,
      })

      saveCustomRegistryButton.disabled = true
      try {
        await server.synchronize({ syncProxy: false, syncIgnore: false })

        if (await ProxyManager.isEnabled()) {
          await ProxyManager.setProxy()
        }
        flashRegistryStatus('customRegistrySaved')
      } catch (error) {
        console.error(`[CustomRegistry] ${error}`)
        flashRegistryStatus('customRegistryInvalid', true)
      } finally {
        saveCustomRegistryButton.disabled = false
      }
    })
  }

  updateLocalRegistryBtn.addEventListener('click', async (event) => {
    togglePopup('popupCompletedSuccessfully')
    ProxyManager.isEnabled().then(async (proxyingEnabled) => {
      await server.synchronize()

      if (proxyingEnabled) {
        await ProxyManager.removeBadProxies()
        await ProxyManager.setProxy()
        await ProxyManager.ping()
      } else {
        console.log('Registry updated, but proxying is disabled.')
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
    const thisExtension = await browser.management.getSelf()
    const extensionsInfo = await browser.management.getAll()
    const { version: currentVersion } = browser.runtime.getManifest()

    const {
      localConfig = {},
      fallbackReason,
      fallbackProxyInUse = false,
      fallbackProxyError,
      proxyLastFetchTs,
    } = await browser.storage.local.get([
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
    await ProxyManager.removeBadProxies()
    await ProxyManager.setProxy()
    await ProxyManager.ping()
    console.log('Censor Tracker has been reset to default settings.')
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
      // A hand-edited or truncated file must not leave the extension
      // half-imported, so both parsing and validation are guarded.
      try {
        const data = JSON.parse(e.target.result)

        await Settings.importSettings(data)
      } catch (error) {
        console.error(`[Settings] Import failed: ${error}`)
        return
      }

      // The import only restored user settings; everything derived from them
      // has to be re-fetched before the page shows the new state.
      await server.synchronize({ syncRegistry: true })
      await ProxyManager.setProxy()
      await ProxyManager.ping()

      // Render new state
      window.location.reload()
    })
    fileReader.readAsText(file)
  })
})()
