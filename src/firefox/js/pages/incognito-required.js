import ProxyManager from '../../../shared/js/extension/base/proxy'

(async () => {
  const closeTab = document.querySelector('#closeTab')
  const backToPopup = document.querySelector('#backToPopup')
  const howToGrantIncognitoAccess = document.querySelector('#howToGrantIncognitoAccess')
  const grantPrivateBrowsingPermissionsButton = document.querySelector('#grantPrivateBrowsingPermissionsButton')

  const [tab] = await browser.tabs.query({
    active: true,
    lastFocusedWindow: true,
  })
  const allowedIncognitoAccess =
    await browser.extension.isAllowedIncognitoAccess()

  grantPrivateBrowsingPermissionsButton.hidden = !allowedIncognitoAccess

  if (backToPopup) {
    backToPopup.addEventListener('click', () => {
      window.location.reload()
    })
  }

  if (closeTab) {
    closeTab.addEventListener('click', () => {
      browser.tabs.remove(tab.id)
    })
  }

  howToGrantIncognitoAccess.addEventListener('click', async () => {
    await browser.tabs.create({
      url: browser.i18n.getMessage('howToGrantIncognitoAccessLink'),
    })
  })

  if (grantPrivateBrowsingPermissionsButton) {
    grantPrivateBrowsingPermissionsButton.addEventListener('click', async () => {
      const proxySet = await ProxyManager.setProxy()

      if (proxySet) {
        await ProxyManager.grantIncognitoAccess()
        window.location.reload()
      }
    })
  }
})()
