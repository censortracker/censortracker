import { proxy } from '@/common/js'

(async () => {
  const backToPopup = document.getElementById('backToPopup')
  const requiredPermissionStatus = document.getElementById('requiredPermissionStatus')
  const grantPrivateWindowsPermissionButton = document.getElementById('grantPrivateWindowsPermissionButton')

  backToPopup.addEventListener('click', () => {
    window.location.href = browser.runtime.getURL('popup.html')
  })

  grantPrivateWindowsPermissionButton.addEventListener('click', async () => {
    const proxySet = await proxy.setProxy()

    requiredPermissionStatus.hidden = false

    if (!proxySet) {
      requiredPermissionStatus.innerText = 'Отсутствуют права на работу в приватных окнах.'
      requiredPermissionStatus.style.color = 'red'
    } else {
      requiredPermissionStatus.innerText = 'Права на работу в приватных окнах получены. Приятного пользования!'
      requiredPermissionStatus.style.color = 'green'
      await browser.browserAction.setBadgeText({ text: '' })
    }
  })
})()
