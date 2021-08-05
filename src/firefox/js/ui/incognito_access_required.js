import { extractDecodedOriginUrl, translateDocument } from '@/common/js'

(async () => {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })

  const originUrl = extractDecodedOriginUrl(tab.url)
  const howToGrantPrivateBrowsingPermissions = document.getElementById('howToGrantPrivateBrowsingPermissions')
  const closeTab = document.getElementById('closeTab')

  howToGrantPrivateBrowsingPermissions.addEventListener('click', () => {
    browser.tabs.create({
      url: browser.i18n.getMessage('howToGranPrivateBrowsingPermissionsLink'),
    })
  })

  closeTab.addEventListener('click', () => {
    browser.tabs.remove(tab.id)
  })

  translateDocument(document, { url: originUrl })
})()
