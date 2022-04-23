import ProxyManager from './proxy'
import Settings from './settings'
import * as storage from './storage'

export const handleOnAlarm = async (alarm) => {
  if (alarm.name === 'refresh-proxy') {
    await ProxyManager.setProxy()
  }
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
