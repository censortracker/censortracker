import { proxy } from '@/common/js'

(async () => {
  const backToPopup = document.getElementById('backToPopup')
  const howToGrantPrivateBrowsingPermissions = document.getElementById('howToGrantPrivateBrowsingPermissions')
  const grantPrivateBrowsingPermissionsButton = document.getElementById('grantPrivateBrowsingPermissionsButton')

  backToPopup.addEventListener('click', () => {
    window.location.href = browser.runtime.getURL('popup.html')
  })

  howToGrantPrivateBrowsingPermissions.addEventListener('click', async () => {
    await browser.tabs.create({ url: 'https://mzl.la/3yPAS4H' })
  })

  grantPrivateBrowsingPermissionsButton.addEventListener('click', async () => {
    const proxySet = await proxy.setProxy()

    if (proxySet === true) {
      window.location.href = browser.runtime.getURL('popup.html')
    }
  })
})()
