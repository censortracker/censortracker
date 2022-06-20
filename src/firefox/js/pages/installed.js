(() => {
  const howToGrantIncognitoAccess = document.querySelector('#howToGrantIncognitoAccess')

  howToGrantIncognitoAccess.addEventListener('click', async () => {
    await browser.tabs.create({
      url: browser.i18n.getMessage('howToGrantIncognitoAccessLink'),
    })
  })
})()
