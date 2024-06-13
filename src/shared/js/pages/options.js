import browser from '../browser-api'
import { server } from '../extension'
import { sendConfigFetchMsg, sendExtensionCallMsg, sendTransitionMsg } from './messaging'

(async () => {
  // For debugging purposes.
  window.server = server

  const source = 'options'
  const { useProxy: proxyingEnabled } = await sendConfigFetchMsg('useProxy')
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

  sendConfigFetchMsg(
    'updateAvailable',
    'backendIsIntermittent',
    'botDetection',
  ).then(({ updateAvailable, backendIsIntermittent, botDetection }) => {
    if (updateAvailable) {
      updateAvailableAlert.classList.remove('hidden')
    }

    if (backendIsIntermittentAlert) {
      backendIsIntermittentAlert.hidden = !backendIsIntermittent
    }
  })

  updateExtensionButton.addEventListener('click', async (event) => {
    sendExtensionCallMsg(source, 'update')
  })

  sendExtensionCallMsg(source, 'isRegistryEmpty').then((isEmpty) => {
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
      await sendConfigFetchMsg('privateBrowsingPermissionsRequired')

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
          const proxySet = await sendExtensionCallMsg('proxy-options', 'setProxy')

          if (proxySet === true) {
            sendExtensionCallMsg(source, 'grantIncognitoAccess')
            privateBrowsingPermissionsRequiredMessage.hidden = true
          }
        },
        )
      }
    }
  }

  if (showNotificationsCheckbox) {
    showNotificationsCheckbox.addEventListener('change', async () => {
      showNotificationsCheckbox.checked ? (
        sendTransitionMsg('enableNotifications')
      ) : (
        sendTransitionMsg('disableNotifications')
      )
    },
    false,
    )

    const { showNotifications } = await sendConfigFetchMsg('showNotifications')

    showNotificationsCheckbox.checked = showNotifications
  }

  const { version: currentVersion } = browser.runtime.getManifest()

  if (version) {
    version.textContent = await browser.i18n.getMessage('optionsVersion', currentVersion)
  }
})()
