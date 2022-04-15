import { translateDocument } from '@/common/js'

(() => {
  const howToGrantIncognitoAccess = document.getElementById('howToGrantIncognitoAccess')

  howToGrantIncognitoAccess.addEventListener('click', async () => {
    await browser.tabs.create({
      url: browser.i18n.getMessage('howToGrantIncognitoAccessLink'),
    })
  })

  translateDocument(document)
})()
