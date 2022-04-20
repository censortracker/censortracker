import Ignore from './ignore'
import ProxyManager from './proxy'
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
    await Ignore.save()
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
