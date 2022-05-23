import ProxyManager from 'Background/proxy'
import { extractDecodedOriginUrl, select, translateDocument } from 'Background/utilities'

(async () => {
  const closeTab = select({ id: 'closeTab' })
  const backToPopup = select({ id: 'backToPopup' })
  const howToGrantIncognitoAccess = select({ id: 'howToGrantIncognitoAccess' })
  const grantPrivateBrowsingPermissionsButton = select({ id: 'grantPrivateBrowsingPermissionsButton' })

  const [tab] = await browser.tabs.query({
    active: true,
    lastFocusedWindow: true,
  })
  const popupUrl = browser.runtime.getURL('popup.html')
  const allowedIncognitoAccess = await browser.extension.isAllowedIncognitoAccess()

  grantPrivateBrowsingPermissionsButton.hidden = !allowedIncognitoAccess

  if (backToPopup) {
    backToPopup.addEventListener('click', () => {
      window.location.href = popupUrl
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
        window.location.href = popupUrl
      }
    })
  }

  translateDocument(document, {
    url: extractDecodedOriginUrl(tab.url),
  })
})()
