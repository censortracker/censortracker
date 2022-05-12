import Ignore from './ignore'
import ProxyManager from './proxy'
import Registry from './registry'
import Settings from './settings'
import * as storage from './storage'
import * as utilities from './utilities'
import Browser from './webextension'

export const handleInformationDisseminationOrganizer = async (url) => {
  const hostname = utilities.extractHostnameFromUrl(url)
  const { notifiedHosts, showNotifications } = await storage.get({
    notifiedHosts: [],
    showNotifications: true,
  })

  if (showNotifications) {
    if (!notifiedHosts.includes(hostname)) {
      console.log(`Showing notification for ${hostname}`)

      await Browser.notifications.create(hostname, {
        type: 'basic',
        title: Settings.getName(),
        iconUrl: Settings.getDangerIcon(),
        message: Browser.i18n.getMessage('cooperationAcceptedMessage', hostname),
      })

      try {
        notifiedHosts.push(hostname)
        await storage.set({ notifiedHosts })
      } catch (error) {
        console.error(error)
      }
    }
  }
}

export const handleOnAlarm = async ({ name }) => {
  console.groupCollapsed('handleOnAlarm')
  console.warn(`Alarm received: ${name}`)

  if (name === 'ignore-fetch') {
    await Ignore.fetch()
  }

  if (name === 'proxy-setProxy') {
    await ProxyManager.setProxy()
  }

  if (name === 'registry-sync') {
    await Registry.sync()
  }
  console.groupEnd()
}

export const handleBeforeRequestPing = async (_details) => {
  await ProxyManager.ping()
}

export const handleStartup = async () => {
  await ProxyManager.setProxy()
}

export const handleProxyError = (details) => {
  console.error(`Proxy error: ${JSON.stringify(details)}`)
}

export const handleIgnoredHostsChange = async ({ ignoredHosts }, _areaName) => {
  if (ignoredHosts && ignoredHosts.newValue) {
    await ProxyManager.setProxy()
  }
}

export const handleCustomProxiedDomainsChange = async ({ customProxiedDomains }, _areaName) => {
  const { enableExtension } = await storage.get({ enableExtension: false })

  if (customProxiedDomains && customProxiedDomains.newValue) {
    if (enableExtension) {
      await ProxyManager.setProxy()
      console.warn('Updated custom proxied domains.')
    }
  }
}

/**
 * Fired when one or more items change.
 * @param changes Object describing the change. This contains one property for each key that changed.
 * @param _areaName The name of the storage area ("sync", "local") to which the changes were made.
 */
export const handleStorageChanged = async ({ enableExtension, ignoredHosts, useProxy }, _areaName) => {
  if (enableExtension || ignoredHosts || useProxy) {
    console.group('handleStorageChanged')

    if (enableExtension) {
      const newValue = enableExtension.newValue
      const oldValue = enableExtension.oldValue

      console.log(`enableExtension: ${oldValue} -> ${newValue}`)

      if (newValue === true && oldValue === false) {
        await ProxyManager.setProxy()
      }

      if (newValue === false && oldValue === true) {
        await ProxyManager.removeProxy()
      }
    }

    if (useProxy && enableExtension === undefined) {
      const newValue = useProxy.newValue
      const oldValue = useProxy.oldValue

      console.log(`useProxy: ${oldValue} -> ${newValue}`)

      const extensionEnabled = await Settings.extensionEnabled()

      if (extensionEnabled) {
        if (newValue === true && oldValue === false) {
          await ProxyManager.setProxy()
        }

        if (newValue === false && oldValue === true) {
          await ProxyManager.removeProxy()
        }
      }
    }
    console.groupEnd()
  }
}
