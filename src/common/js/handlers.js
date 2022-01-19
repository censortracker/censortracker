import {
  enforceHttpsConnection,
  ignore,
  proxy,
  registry,
  settings,
  storage,
} from '.'

/**
 * Fires when a request is about to occur.
 * This function allows users to use your proxy.
 * This feature exists because of free proxy abusers.
 * @param _details
 */
export const handlerBeforeRequestPing = (_details) => {
  proxy.ping()
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

export const handleWindowRemoved = async (_windowId) => {
  await storage.remove(['notifiedHosts'])
}

export const handleStartup = async () => {
  await registry.sync()
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

export const handleOptionsChange = async ({ enableExtension, ignoredHosts, useProxy }, _areaName) => {
  if (ignoredHosts && ignoredHosts.newValue) {
    ignore.save()
  }

  if (useProxy && enableExtension === undefined) {
    const newValue = useProxy.newValue
    const oldValue = useProxy.oldValue

    const extensionEnabled = settings.extensionEnabled()

    if (extensionEnabled) {
      if (newValue === true && oldValue === false) {
        await proxy.setProxy()
      }

      if (newValue === false && oldValue === true) {
        await proxy.removeProxy()
      }
    }
  }
}
