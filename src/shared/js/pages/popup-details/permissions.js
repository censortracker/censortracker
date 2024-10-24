import { sendExtensionCallMsg } from '../messaging'

export const showPermissionsPopup = async () => {
  const incognitoRequestPopup = document.getElementById('incognitoRequest')
  const howToGrantIncognitoAccess = document.querySelector('#howToGrantIncognitoAccess')
  const grantPrivateBrowsingPermissionsButton = document.querySelector('#grantPrivateBrowsingPermissionsButton')

  const allowedIncognitoAccess =
    await browser.extension.isAllowedIncognitoAccess()

  grantPrivateBrowsingPermissionsButton.hidden = !allowedIncognitoAccess

  howToGrantIncognitoAccess.addEventListener('click', async () => {
    await browser.tabs.create({
      url: browser.i18n.getMessage('howToGrantIncognitoAccessLink'),
    })
  })

  if (grantPrivateBrowsingPermissionsButton) {
    grantPrivateBrowsingPermissionsButton.addEventListener('click', async () => {
      const proxySet = await sendExtensionCallMsg('proxy-options', 'setProxy')

      if (proxySet) {
        await sendExtensionCallMsg('proxy-options', 'setProxy')
        window.location.reload()
      }
    })
  }

  incognitoRequestPopup.hidden = false
}
