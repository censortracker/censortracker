import { select, translateDocument } from 'Background/utilities'

(() => {
  const howToGrantIncognitoAccess = select({ id: 'howToGrantIncognitoAccess' })

  howToGrantIncognitoAccess.addEventListener('click', async () => {
    await browser.tabs.create({
      url: browser.i18n.getMessage('howToGrantIncognitoAccessLink'),
    })
  })
  translateDocument(document)
})()
