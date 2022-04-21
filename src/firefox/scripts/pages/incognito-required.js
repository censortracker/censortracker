import ProxyManager from '@/shared/scripts/proxy'
import { extractDecodedOriginUrl, select, translateDocument } from '@/shared/scripts/utilities'

(async () => {
  const closeTab = select({ id: 'closeTab' })
  const backToPopup = select({ id: 'backToPopup' })
  const howToGrantIncognitoAccess = select({ id: 'howToGrantIncognitoAccess' })
  const grantPrivateBrowsingPermissionsButton = select({ id: 'grantPrivateBrowsingPermissionsButton' })

  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
  const allowedIncognitoAccess = await browser.extension.isAllowedIncognitoAccess()
  const originUrl = extractDecodedOriginUrl(tab.url)

  if (backToPopup) {
    backToPopup.addEventListener('click', () => {
      window.location.href = browser.runtime.getURL('popup.html')
    })
  }

  grantPrivateBrowsingPermissionsButton.hidden = !allowedIncognitoAccess

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

      if (proxySet === true) {
        await ProxyManager.grantIncognitoAccess()
        window.location.href = browser.runtime.getURL('popup.html')
      }
    })
  }

  translateDocument(document, { url: originUrl })
})()
