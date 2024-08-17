import browser from '../../../browser-api'
import configManager from '../config'
import * as server from '../server'
import { getBadProxies, ping, requestIncognitoAccess, setProxy, usingCustomProxy } from './proxy'

export const handleBeforeRequest = async (_details) => {
  await ping()
  await requestIncognitoAccess()
}

export const handleProxyError = async ({ error }) => {
  const customProxyInUse = await usingCustomProxy()

  // Custom proxy is used, so we don't need to handle this error
  if (customProxyInUse) {
    return
  }

  error = error.replace('net::', '')

  const proxyErrors = [
    // Firefox
    'NS_ERROR_UNKNOWN_PROXY_HOST',
    // Chrome
    'ERR_PROXY_CONNECTION_FAILED',
  ]

  if (proxyErrors.includes(error)) {
    const {
      currentProxyServer,
      fallbackProxyInUse,
    } = await configManager.get('currentProxyServer', 'fallbackProxyInUse')

    if (fallbackProxyInUse) {
      await configManager.set({
        proxyIsAlive: false,
        fallbackProxyError: error,
      })
      console.warn('Fallback proxy is intermittent, interrupting auto fetch...')
      return
    }

    console.error(`Error on connection to ${currentProxyServer}: ${error}`)

    if (currentProxyServer) {
      const badProxies = await getBadProxies()

      if (!badProxies.includes(currentProxyServer)) {
        badProxies.push(currentProxyServer)
        await configManager.set({ badProxies })
      }

      browser.tabs.query({
        active: true,
        lastFocusedWindow: true,
      }).then(async (tab) => {
        console.warn('Requesting new proxy server...')
        await server.synchronize({
          syncIgnore: false,
          syncRegistry: false,
          syncProxy: true,
        })
        await setProxy()
        await ping()
        browser.tabs.reload(tab.id)
      })
    }
  }
}
