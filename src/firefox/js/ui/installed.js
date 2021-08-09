import { translateDocument } from '@/common/js'

(() => {
  const howToGrantPrivateBrowsingPermissions = document.getElementById('howToGrantPrivateBrowsingPermissions')

  howToGrantPrivateBrowsingPermissions.addEventListener('click', async () => {
    await browser.tabs.create({
      url: browser.i18n.getMessage('howToGrantPrivateBrowsingPermissionsLink'),
    })
  })

  translateDocument(document)
})()
