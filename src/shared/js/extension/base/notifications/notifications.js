import browser from '../../../browser-api'
import { extractDomainFromUrl } from '../../../utilities'
import configManager from '../config'
import { extensionName } from '../config/constants'
import IconManager from '../icon'

export const areEnabled = async () => {
  const { showNotifications } = await configManager.get('showNotifications')

  return showNotifications
}

export const enable = async () => {
  await configManager.set({ showNotifications: true })
}

export const disable = async () => {
  await configManager.set({ showNotifications: false })
}

export const showDisseminatorWarning = async (url) => {
  const hostname = extractDomainFromUrl(url)

  const {
    notifiedHosts,
    showNotifications,
  } = await configManager.get('notifiedHosts', 'showNotifications')

  if (showNotifications && !notifiedHosts.includes(hostname)) {
    await browser.notifications.create(hostname, {
      type: 'basic',
      title: extensionName,
      iconUrl: IconManager.getDangerIcon(),
      message: browser.i18n.getMessage('cooperationAcceptedMessage', hostname),
    })

    try {
      notifiedHosts.push(hostname)
      configManager.set({ notifiedHosts })
    } catch (error) {
      console.error(error)
    }
  }
}
