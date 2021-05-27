import { proxy } from '@/common/js'

(async () => {
  const backToPopup = document.getElementById('backToPopup')
  const howToGrantPrivateWindowsPermission = document.getElementById('howToGrantPrivateWindowsPermission')
  const grantPrivateWindowsPermissionButton = document.getElementById('grantPrivateWindowsPermissionButton')

  backToPopup.addEventListener('click', () => {
    window.location.href = browser.runtime.getURL('popup.html')
  })

  grantPrivateWindowsPermissionButton.addEventListener('click', async () => {
    const proxySet = await proxy.setProxy()

    if (proxySet === true) {
      window.location.href = browser.runtime.getURL('popup.html')
    } else {
      howToGrantPrivateWindowsPermission.style.color = 'hsl(348, 100%, 61%)'
    }
  })
})()
