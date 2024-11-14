import browser from '../../../browser-api'
import ConfigManager, { constants } from '../config'
import IconManager from '../icon'
import Ignore from '../ignore'
import NotificationsManager from '../notifications'
import p2pManager from '../p2p'
import ProxyManager from '../proxy'
import Registry from '../registry'
import * as server from '../server'
import Task from '../task'
import * as ExtensionHandlers from './handlers'

export const name = constants.extensionName

export const isEnabled = async () => {
  return ConfigManager.get('enableExtension')
}

export const enable = async () => {
  await ConfigManager.set({ enableExtension: true })
}

export const disable = async () => {
  await ConfigManager.set({ enableExtension: false })
}

export const reset = async () => {
  await ConfigManager.set({
    useOwnProxy: false,
    usePremiumProxy: false,
    haveActivePremiumConfig: false,
  })
  await server.synchronize()
  await enable()
  await NotificationsManager.enable()
  // await Settings.disableParentalControl()
  await ProxyManager.removeBadProxies()
  await ProxyManager.setProxy()
  await ProxyManager.ping()
  console.warn('Censor Tracker has been reset to default settings.')
}

export const processHostName = async (host) => {
  if (!host) {
    return {}
  }
  let blocked = false

  const ignored = await Ignore.contains(host)
  const { url: isDisseminator, cooperationRefused } =
    await Registry.retrieveDisseminator(host)

  if (!ignored) {
    blocked = await Registry.contains(host)
  }

  return {
    ignored,
    blocked,
    isDisseminator,
    cooperationRefused,
  }
}

export const showInstalledPage = async () => {
  await browser.tabs.create({ url: 'installed.html' })
}

export { ExtensionHandlers as handlers }
export {
  ConfigManager as config,
  IconManager as icon,
  Ignore as ignoredDomains,
  NotificationsManager as notifications,
  p2pManager as p2p,
  ProxyManager as proxy,
  Registry as registry,
  Task as taskManager,
}
