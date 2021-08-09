import { extractDecodedOriginUrl, proxy, select, translateDocument } from '@/common/js'

(async () => {
  const closeTab = select({ id: 'closeTab', doc: document })
  const backToPopup = select({ id: 'backToPopup', doc: document })
  const howToGrantIncognitoAccess = select({ id: 'howToGrantIncognitoAccess', doc: document })
  const grantPrivateBrowsingPermissionsButton = select({ id: 'grantPrivateBrowsingPermissionsButton', doc: document })

  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
  const originUrl = extractDecodedOriginUrl(tab.url)

  if (backToPopup) {
    backToPopup.addEventListener('click', () => {
      window.location.href = browser.runtime.getURL('popup.html')
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
      const proxySet = await proxy.setProxy()

      if (proxySet === true) {
        await proxy.grantIncognitoAccess()
        window.location.href = browser.runtime.getURL('popup.html')
      }
    })
  }

  translateDocument(document, { url: originUrl })
})()
