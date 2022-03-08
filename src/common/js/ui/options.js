import { proxy, registry, settings, storage, translateDocument } from '@/common/js'

(async () => {
  translateDocument(document)
  const currentBrowser = settings.getBrowser()
  const proxyRegion = document.getElementById('proxyRegion')
  const useDPIDetectionCheckbox = document.getElementById('useDPIDetectionCheckbox')
  const showNotificationsCheckbox = document.getElementById('showNotificationsCheckbox')
  const howToGrantIncognitoAccess = document.getElementById('howToGrantIncognitoAccess')
  const grantPrivateBrowsingPermissionsButton = document.getElementById('grantPrivateBrowsingPermissionsButton')
  const privateBrowsingPermissionsRequiredMessage = document.getElementById('privateBrowsingPermissionsRequiredMessage')

  const { useProxy } = await storage.get({ useProxy: false })

  let proxyRegionText = currentBrowser.i18n.getMessage('proxyRegionTurnedOff')

  if (useProxy) {
    proxyRegionText = currentBrowser.i18n.getMessage('proxyRegionTurnedOn')
  }

  const { countryDetails: { name: countryName } } = await registry.getConfig()

  if (proxyRegion) {
    proxyRegion.innerText = `${proxyRegionText} | ${countryName}`
    proxyRegion.hidden = false
  }

  if (settings.isFirefox) {
    const allowedIncognitoAccess = await browser.extension.isAllowedIncognitoAccess()
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
          const proxySet = await proxy.setProxy()

          if (proxySet === true) {
            await proxy.grantIncognitoAccess()
            privateBrowsingPermissionsRequiredMessage.hidden = true
          }
        })
      }
    }
  }

  if (showNotificationsCheckbox) {
    showNotificationsCheckbox.addEventListener('change', async () => {
      if (showNotificationsCheckbox.checked) {
        await settings.enableNotifications()
      } else {
        await settings.disableNotifications()
      }
    }, false)

    const { showNotifications } = await storage.get({ showNotifications: true })

    showNotificationsCheckbox.checked = showNotifications
  }

  if (useDPIDetectionCheckbox) {
    useDPIDetectionCheckbox.addEventListener('change', async () => {
      if (useDPIDetectionCheckbox.checked) {
        await settings.enableDPIDetection()
      } else {
        await settings.disableDPIDetection()
      }
    }, false)

    const { useDPIDetection } = await storage.get({ useDPIDetection: false })

    useDPIDetectionCheckbox.checked = useDPIDetection
  }
})()
