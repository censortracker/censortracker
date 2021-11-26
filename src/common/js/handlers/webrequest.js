import {
  enforceHttpsConnection,
  extractHostnameFromUrl,
  ignore,
  proxy,
  settings,
} from '@/common/js'

const currentBrowser = settings.getBrowser()

/**
 * Fires when a request is about to occur. This event is sent before any TCP
 * connection is made and can be used to cancel or redirect requests.
 * @param url Current URL address.
 * @returns {undefined|{redirectUrl: *}} Undefined or redirection to HTTPS.
 */
export const handleBeforeRequest = ({ url }) => {
  const hostname = extractHostnameFromUrl(url)

  if (settings.isFirefox) {
    const isAllowed = currentBrowser.extension.isAllowedIncognitoAccess()

    isAllowed.then(async (allowed) => {
      if (!allowed) {
        await proxy.requestIncognitoAccess()
      }
    })
  }

  if (ignore.contains(hostname)) {
    return undefined
  }

  console.warn(`Request redirected to HTTPS: ${hostname}`)
  proxy.ping()
  return {
    redirectUrl: enforceHttpsConnection(url),
  }
}
