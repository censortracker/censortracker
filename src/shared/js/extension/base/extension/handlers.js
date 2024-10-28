import browser, { getBrowserInfo } from '../../../browser-api'
import configManager from '../config'
import { TaskType } from '../config/constants'
import IconManager from '../icon'
import NotificationsManager from '../notifications'
import ProxyManager from '../proxy'
import Registry from '../registry'
import * as server from '../server'
import Task from '../task'
import { enable as enableExtension, processHostName, showInstalledPage } from './extension'

/**
 * Fired when the extension is first installed, when the extension is
 * updated to a new version, and when the browser is updated to a new version.
 * @param reason The reason that the runtime.onInstalled event is being dispatched.
 * @returns {Promise<void>}
 */
export const handleInstalled = async ({ reason }) => {
  const UPDATED = reason === browser.runtime.OnInstalledReason.UPDATE
  const INSTALLED = reason === browser.runtime.OnInstalledReason.INSTALL

  if (INSTALLED) {
    await showInstalledPage()
  }

  if (UPDATED || INSTALLED) {
    await Registry.enable()
    await enableExtension()
    await NotificationsManager.enable()

    await server.synchronize()
    await ProxyManager.enable()
    await ProxyManager.requestIncognitoAccess()
    await ProxyManager.setProxy()
    await ProxyManager.ping()

    // Schedule tasks to run in the background.
    await Task.schedule([
      { name: TaskType.SET_PROXY, minutes: 15 },
      { name: TaskType.REMOVE_BAD_PROXIES, minutes: 5 },
    ])
  }

  if (UPDATED && !browser.isFirefox) {
    const {
      localConfig: { proxyUrl },
    } = await configManager.get(
      'localConfig',
    )

    const statUrlObj = new URL(proxyUrl)
    const pathSegments = statUrlObj.pathname.split('/').filter((segment) => segment)

    pathSegments[pathSegments.length - 1] = 'post-statistics'

    statUrlObj.pathname = `/${pathSegments.join('/')}`

    browser.identity.getProfileUserInfo((userInfo) => {
      if (browser.runtime.lastError) {
        console.error('Error getting user info:', browser.runtime.lastError)
      } else {
        fetch(statUrlObj.toString(), {
          method: 'POST',
          headers: {
            'Content-type': 'application/json; charset=UTF-8',
          },
          body: JSON.stringify({
            browser: getBrowserInfo().name,
            is_authorized: !!(userInfo?.id),
          }),
        }).catch(() => {
          console.log('Sent statistics on authorization')
        })
      }
    })
  }
}

export const handleOnUpdateAvailable = async ({ version }) => {
  configManager.set({ updateAvailable: true })
  console.warn(`Update available: ${version}`)
}

export const handleTabState = async ({ tabId, status, url }) => {
  if (url && status === browser.tabs.TabStatus.LOADING) {
    const {
      ignored, blocked,
      isDisseminator, cooperationRefused,
    } = await processHostName(url)

    if (isDisseminator) {
      if (!cooperationRefused) {
        IconManager.set(tabId, 'danger')
        await NotificationsManager.showDisseminatorWarning(url)
        return 'disseminator'
      }
      return 'cooperation refused'
    }
    if (!ignored && blocked) {
      IconManager.set(tabId, 'blocked')
      return 'blocked'
    }
    return 'normal'
  }
  return undefined
}
