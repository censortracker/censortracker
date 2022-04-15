import {
  ignore,
  proxy,
  storage,
} from '.'

export const handlerBeforeRequestPing = async (_details) => {
  await proxy.ping()
}

export const handleStartup = async () => {
  await proxy.setProxy()
}

export const handleProxyError = (details) => {
  console.error(`Proxy error: ${JSON.stringify(details)}`)
}

export const handleIgnoredHostsChange = async ({ ignoredHosts }, _areaName) => {
  if (ignoredHosts && ignoredHosts.newValue) {
    await ignore.save()
    await proxy.setProxy()
  }
}

export const handleCustomProxiedDomainsChange = async ({ customProxiedDomains }, _areaName) => {
  const { enableExtension } = await storage.get({ enableExtension: false })

  if (customProxiedDomains && customProxiedDomains.newValue) {
    if (enableExtension) {
      await proxy.setProxy()
      console.warn('Updated custom proxied domains.')
    }
  }
}
