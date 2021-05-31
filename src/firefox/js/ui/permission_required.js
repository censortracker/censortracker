import { proxy } from '@/common/js'

(async () => {
  const backToPopup = document.getElementById('backToPopup')
  const howToGrantPrivateWindowsPermission = document.getElementById('howToGrantPrivateWindowsPermission')
  const grantPrivateWindowsPermissionButton = document.getElementById('grantPrivateWindowsPermissionButton')

  backToPopup.addEventListener('click', () => {
    window.location.href = browser.runtime.getURL('popup.html')
  })

  howToGrantPrivateWindowsPermission.addEventListener('click', async () => {
    await browser.tabs.create({ url: 'https://mzl.la/3yPAS4H' })
  })

  grantPrivateWindowsPermissionButton.addEventListener('click', async () => {
    const proxySet = await proxy.setProxy()

    if (proxySet === true) {
      window.location.href = browser.runtime.getURL('popup.html')
    }
  })
})()
