import browser from 'Background/browser-api'
import ProxyManager from 'Background/proxy'
import Registry from 'Background/registry'
import { dismissUpdate, getReleasesPageUrl } from 'Background/update'
import { i18nGetMessage } from 'Background/utilities'

(async () => {
  const proxyingEnabled = await ProxyManager.isEnabled()
  const version = document.getElementById('version')
  const proxyStatus = document.getElementById('proxyStatus')
  const showNotificationsCheckbox = document.getElementById(
    'showNotificationsCheckbox',
  )
  const howToGrantIncognitoAccess = document.getElementById(
    'howToGrantIncognitoAccess',
  )
  const grantPrivateBrowsingPermissionsButton = document.getElementById(
    'grantPrivateBrowsingPermissionsButton',
  )
  const privateBrowsingPermissionsRequiredMessage = document.getElementById(
    'privateBrowsingPermissionsRequiredMessage',
  )
  const optionsRegistryIsEmptyWarning = document.getElementById(
    'optionsRegistryIsEmptyWarning',
  )
  const optionsRegistryUpdateDatabaseButton = document.getElementById(
    'optionsRegistryUpdateDatabaseButton',
  )
  const optionsRegistryProxyingListButton = document.getElementById(
    'optionsRegistryProxyingListButton',
  )
  const backendIsIntermittentAlert = document.getElementById('backendIsIntermittentAlert')
  const updateAvailableAlert = document.getElementById('updateAvailableAlert')
  const updateExtensionButton = document.getElementById('updateExtensionButton')

  browser.storage.local.get({
    updateAvailable: false,
    latestVersion: '',
    latestReleaseUrl: '',
    backendIsIntermittent: false,
  }).then(({
    updateAvailable,
    latestVersion,
    latestReleaseUrl,
    backendIsIntermittent,
  }) => {
    if (updateAvailable) {
      updateAvailableAlert.classList.remove('hidden')
      // This build comes from GitHub, so "update" means "go and download the
      // new package" — reloading the extension would only restart the version
      // that is already installed.
      updateExtensionButton.href = latestReleaseUrl || getReleasesPageUrl()
      updateExtensionButton.target = '_blank'
      updateExtensionButton.rel = 'noopener noreferrer'
      if (latestVersion) {
        updateExtensionButton.textContent =
          `${i18nGetMessage('updateAvailableButtonTitle')} — ${latestVersion}`
      }
    }

    if (backendIsIntermittentAlert) {
      backendIsIntermittentAlert.hidden = !backendIsIntermittent
    }
  })

  updateExtensionButton.addEventListener('click', () => {
    dismissUpdate().catch((error) => {
      console.warn(`Could not clear the update badge: ${error}`)
    })
  })

  Registry.isEmpty().then((isEmpty) => {
    if (isEmpty) {
      optionsRegistryUpdateDatabaseButton.addEventListener('click', (event) => {
        window.location.href = 'advanced-options.html'
      })

      optionsRegistryProxyingListButton.addEventListener('click', (event) => {
        window.location.href = 'proxy-list.html'
      })
      optionsRegistryIsEmptyWarning.classList.remove('hidden')
    }
  })

  if (proxyStatus) {
    let proxyStatusMessage = 'optionsProxyStatusTurnedOff'

    if (proxyingEnabled) {
      proxyStatusMessage = 'optionsProxyStatusTurnedOn'
    }
    proxyStatus.innerText = browser.i18n.getMessage(proxyStatusMessage)
    proxyStatus.hidden = false
  }

  if (browser.isFirefox) {
    const allowedIncognitoAccess =
      await browser.extension.isAllowedIncognitoAccess()
    const { privateBrowsingPermissionsRequired } =
      await browser.storage.local.get({
        privateBrowsingPermissionsRequired: false,
      })

    if (grantPrivateBrowsingPermissionsButton) {
      grantPrivateBrowsingPermissionsButton.hidden = !allowedIncognitoAccess
    }

    if (howToGrantIncognitoAccess) {
      howToGrantIncognitoAccess.addEventListener('click', async () => {
        await browser.tabs.create({
          url: browser.i18n.getMessage('howToGrantIncognitoAccessLink'),
        })
      })
    }

    if (privateBrowsingPermissionsRequired || !allowedIncognitoAccess) {
      if (privateBrowsingPermissionsRequiredMessage) {
        privateBrowsingPermissionsRequiredMessage.hidden = false
      }

      if (grantPrivateBrowsingPermissionsButton) {
        grantPrivateBrowsingPermissionsButton.addEventListener('click', async () => {
          const proxySet = await ProxyManager.setProxy()

          if (proxySet === true) {
            await ProxyManager.grantIncognitoAccess()
            privateBrowsingPermissionsRequiredMessage.hidden = true
          }
        },
        )
      }
    }
  }

  if (showNotificationsCheckbox) {
    showNotificationsCheckbox.addEventListener('change', async () => {
      await browser.storage.local.set({
        showNotifications: showNotificationsCheckbox.checked,
      })
    },
    false,
    )

    const { showNotifications } = await browser.storage.local.get({
      showNotifications: true,
    })

    showNotificationsCheckbox.checked = showNotifications
  }

  const { version: currentVersion } = browser.runtime.getManifest()

  if (version) {
    version.textContent = await browser.i18n.getMessage('optionsVersion', currentVersion)
  }
})()
