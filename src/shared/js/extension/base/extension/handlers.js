import browser from '../../../browser-api'
import configManager from '../config'
import { TaskType } from '../config/constants'
import IconManager from '../icon'
import NotificationsManager from '../notifications'
import ProxyManager from '../proxy'
import Registry from '../registry'
import * as server from '../server'
import Task from '../task'

export class ExtensionHandlers {
  constructor (extensionManager) {
    this.extension = extensionManager
  }

  /**
 * Fired when the extension is first installed, when the extension is
 * updated to a new version, and when the browser is updated to a new version.
 * @param reason The reason that the runtime.onInstalled event is being dispatched.
 * @returns {Promise<void>}
 */
  async handleInstalled ({ reason }) {
    const UPDATED = reason === browser.runtime.OnInstalledReason.UPDATE
    const INSTALLED = reason === browser.runtime.OnInstalledReason.INSTALL

    if (INSTALLED) {
      await this.extension.showInstalledPage()
    }

    if (UPDATED || INSTALLED) {
      await Registry.enable()
      await this.extension.enable()
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
  }

  async handleOnUpdateAvailable ({ version }) {
    configManager.set({ updateAvailable: true })
    console.warn(`Update available: ${version}`)
  }

  async handleTabState ({ tabId, status, url }) {
    if (url && status === browser.tabs.TabStatus.LOADING) {
      this.extension.processHostName(url).then(
        async ({ ignored, blocked, isDisseminator, cooperationRefused }) => {
          if (isDisseminator) {
            if (!cooperationRefused) {
              IconManager.set(tabId, 'danger')
              await NotificationsManager.showDisseminatorWarning(url)
            }
          }
          if (!ignored && blocked) {
            IconManager.set(tabId, 'blocked')
          }
        },
      )
    }
  }
}
