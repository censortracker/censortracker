import {
  enforceHttpsConnection,
  extractHostnameFromUrl,
  ignore,
  proxy,
  settings,
} from '@/common/js'

const browserAPI = settings.getBrowser()

/**
 * Fires when a request is about to occur. This event is sent before any TCP
 * connection is made and can be used to cancel or redirect requests.
 * @param url Current URL address.
 * @returns {undefined|{redirectUrl: *}} Undefined or redirection to HTTPS.
 */
export const handleBeforeRequest = ({ url }) => {
  const hostname = extractHostnameFromUrl(url)

  if (settings.isFirefox) {
    browserAPI.extension.isAllowedIncognitoAccess()
      .then(async (allowed) => {
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

/**
 * Fires when a request could not be processed successfully.
 * @param url Current URL address.
 * @param error The error description.
 * @param tabId The ID of the tab in which the request takes place.
 */
// eslint-disable-next-line handle-callback-err
export const handleErrorOccurred = ({ error, url, tabId }) => {}
