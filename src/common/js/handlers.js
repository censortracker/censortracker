import {
  enforceHttpsConnection,
  ignore,
  proxy,
  storage,
} from '.'

/**
 * Fires when a request is about to occur.
 * This function allows users to use your proxy.
 * This feature exists because of free proxy abusers.
 * @param _details
 */
export const handlerBeforeRequestPing = async (_details) => {
  await proxy.ping()
}

/**
 * Fires when a request is about to occur. This event is sent before any TCP
 * connection is made and can be used to cancel or redirect requests.
 * @param url Current URL address.
 * @returns {undefined|{redirectUrl: *}} Undefined or redirection to HTTPS.
 */
export const handleBeforeRequestRedirectToHttps = ({ url }) => {
  console.warn(`Request redirected to HTTPS for ${url}`)

  if (ignore.contains(url)) {
    return undefined
  }

  return {
    redirectUrl: enforceHttpsConnection(url),
  }
}

export const handleStartup = async () => {
  await proxy.setProxy()
}

export const handleProxyError = (details) => {
  console.error(`Proxy error: ${JSON.stringify(details)}`)
}

export const handleEnableExtension = async ({ enableExtension: { newValue, oldValue } = {} }) => {
  if (newValue === true && oldValue === false) {
    await proxy.setProxy()
  }

  if (newValue === false && oldValue === true) {
    await proxy.removeProxy()
  }
}

export const handleIgnoredHostsChange = async ({ ignoredHosts }, _areaName) => {
  if (ignoredHosts && ignoredHosts.newValue) {
    ignore.save()
    await proxy.setProxy()
  }
}

export const handleCustomProxiedDomainsChange = async ({ customProxiedDomains }, _areaName) => {
  const { enableExtension, useProxy } = await storage.get({ enableExtension: false, useProxy: false })

  if (customProxiedDomains && customProxiedDomains.newValue) {
    if (enableExtension && useProxy) {
      await proxy.setProxy()
      console.warn('Updated custom proxied domains.')
    }
  }
}
