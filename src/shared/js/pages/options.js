import ProxyManager from 'Background/proxy'
import Registry from 'Background/registry'
import * as storage from 'Background/storage'
import Browser from 'Background/webextension';

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

  storage.get('backendIsIntermittent')
    .then(({ backendIsIntermittent = false }) => {
      backendIsIntermittentAlert.hidden = !backendIsIntermittent
    })

  Registry.isEmpty().then((isEmpty) => {
    if (isEmpty) {
      optionsRegistryUpdateDatabaseButton.addEventListener('click', (event) => {
        window.location.href = 'advanced-options.html'
      })

      optionsRegistryProxyingListButton.addEventListener('click', (event) => {
        window.location.href = 'proxied-websites-editor.html'
      })
      optionsRegistryIsEmptyWarning.classList.remove('hidden')
    }
  })

  if (proxyStatus) {
    let proxyStatusMessage = 'optionsProxyStatusTurnedOff'

    if (proxyingEnabled) {
      proxyStatusMessage = 'optionsProxyStatusTurnedOn'
    }
    proxyStatus.innerText = Browser.i18n.getMessage(proxyStatusMessage)
    proxyStatus.hidden = false
  }

  if (Browser.IS_FIREFOX) {
    const allowedIncognitoAccess =
      await browser.extension.isAllowedIncognitoAccess()
    const { privateBrowsingPermissionsRequired } = await storage.get({
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
      privateBrowsingPermissionsRequiredMessage.hidden = false

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
      if (showNotificationsCheckbox.checked) {
        console.log('Notifications enabled.')
        await storage.set({ showNotifications: true })
      } else {
        console.log('Notifications disabled.')
        await storage.set({ showNotifications: false })
      }
    },
    false,
    )

    const { showNotifications } = await storage.get({
      showNotifications: true,
    })

    showNotificationsCheckbox.checked = showNotifications
  }

  const { version: currentVersion } = Browser.runtime.getManifest()

  if (version) {
    version.textContent = await Browser.i18n.getMessage('optionsVersion', currentVersion)
  }
})()
