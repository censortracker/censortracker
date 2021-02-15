/**
 * Validate passed URL using regex.
 * @param url URL
 * @returns {boolean} true if valid otherwise false
 */
export const validateUrl = (url) => {
  const pattern = new RegExp(
    '^(https?:\\/\\/)?' +
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' +
    '((\\d{1,3}\\.){3}\\d{1,3}))' +
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' +
    '(\\?[;&a-z\\d%_.~+=-]*)?' +
    '(\\#[-a-z\\d_]*)?$',
    'i',
  )

  if (url.startsWith('about:') || url.startsWith('chrome-extension:')) {
    return false
  }

  return !!pattern.test(url)
}

/**
 * Extract hostname from the URL address.
 * @param url URL string.
 * @returns {string} Extracted hostname.
 */
export const extractHostnameFromUrl = (url) => {
  const regEx = /^(?:https?:\/\/)?(?:www\.)?/i

  url = url.replace(regEx, '')

  if (url.indexOf('/') !== -1) {
    url = url.split('/')[0]
  }

  url = url.trim()

  try {
    return new URL(url).hostname
  } catch (error) {
    return url
  }
}

/**
 * Enforce HTTP in for the passed URL.
 * @param url URL address.
 * @returns {*} URL with "http://" prefix.
 */
export const enforceHttpConnection = (url) => {
  return url.replace(/^https:/, 'http:')
}

/**
 * Enforce HTTPS for the passed URL.
 * @param url URL address.
 * @returns {*} URL with "https://" prefix.
 */
export const enforceHttpsConnection = (url) => {
  return url.replace(/^http:/, 'https:')
}

/**
 * Returns an object describing filters to apply to webRequest events.
 * @param http Include all HTTP resource to "urls" array.
 * @param https Include all HTTPS resource to "urls" array.
 * @param types This type is a string, which represents the context
 * in which a resource was fetched in a web request.
 * @returns {{urls: [], types: [string]}} Request filter.
 */
export const getRequestFilter = ({ http = true, https = true, types = undefined } = {}) => {
  // See: https://mzl.la/3tnkndy
  const urls = []

  if (types === undefined) {
    types = ['main_frame']
  }

  if (http) {
    urls.push('http://*/*')
  }

  if (https) {
    urls.push('https://*/*')
  }

  return { urls, types }
}

/**
 * Returns object with browser name.
 * @returns {{firefox: boolean}|{}|{chrome: boolean}}
 */
export const getBrowserName = () => {
  const userAgent = navigator.userAgent.match(/Chrome|Firefox/i)

  if (userAgent.includes('Chrome')) {
    return { chrome: true }
  }
  if (userAgent.includes('Firefox')) {
    return { firefox: true }
  }
  return { unknown: true }
}
