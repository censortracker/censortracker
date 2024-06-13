import browser from '../../../browser-api'
import ConfigManager, { constants } from '../config'
import IconManager from '../icon'
import Ignore from '../ignore'
import NotificationsManager from '../notifications'
import ProxyManager from '../proxy'
import Registry from '../registry'
import * as server from '../server'
import Task from '../task'
import { ExtensionHandlers } from './handlers'

class Extension {
  constructor () {
    this.config = ConfigManager
    this.icon = IconManager
    this.ignoredDomains = Ignore
    this.notifications = NotificationsManager
    this.proxy = ProxyManager
    this.registry = Registry
    this.taskManager = Task

    this.handlers = new ExtensionHandlers(this)
  }

  get name () {
    return constants.extensionName
  }

  async isEnabled () {
    return ConfigManager.get('enableExtension')
  }

  async enable () {
    await ConfigManager.set({ enableExtension: true })
  }

  async disable () {
    await ConfigManager.set({ enableExtension: false })
  }

  async reset () {
    await server.synchronize()
    await this.enable()
    await NotificationsManager.enable()
    // await Settings.disableParentalControl()
    await ProxyManager.removeBadProxies()
    await ProxyManager.setProxy()
    await ProxyManager.ping()
    console.warn('Censor Tracker has been reset to default settings.')
  }

  async processHostName (host) {
    if (!host) {
      return {}
    }
    let blocked = false

    const ignored = await this.ignoredDomains.contains(host)
    const { url: isDisseminator, cooperationRefused } =
      await this.registry.retrieveDisseminator(host)

    if (!ignored) {
      blocked = await this.registry.contains(host)
    }

    return {
      ignored,
      blocked,
      isDisseminator,
      cooperationRefused,
    }
  }

  async showInstalledPage () {
    await browser.tabs.create({ url: 'installed.html' })
  }
}

export default new Extension()
