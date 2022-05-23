import { select, translateDocument } from '@/shared/js/background/utilities'

(() => {
  const howToGrantIncognitoAccess = select({ id: 'howToGrantIncognitoAccess' })

  howToGrantIncognitoAccess.addEventListener('click', async () => {
    await browser.tabs.create({
      url: browser.i18n.getMessage('howToGrantIncognitoAccessLink'),
    })
  })
  translateDocument(document)
})()
