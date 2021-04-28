/**
 * Validate passed URL using regex.
 * @param url URL
 * @returns {boolean} true if valid otherwise false
 */
export const isValidURL = (url) => {
  const pattern = new RegExp(
    '^(https?:\\/\\/)?' +
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' +
    '((\\d{1,3}\\.){3}\\d{1,3}))' +
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' +
    '(\\?[;&a-z\\d%_.~+=-]*)?' +
    '(\\#[-a-z\\d_]*)?$',
    'i',
  )

  if (!url || url.startsWith('about:') || url.startsWith('chrome-extension:')) {
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
 * Search for target in array
 * @param array Array for search.
 * @param target Target.
 * @returns {boolean} true or false
 */
export const arrayContains = (array, target) => {
  if (Array.isArray(array)) {
    array.sort()
  }

  let left = 0
  let right = array.length - 1

  while (left <= right) {
    const mid = left + Math.floor((right - left) / 2)

    if (array[mid] === target) {
      return true
    }

    if (array[mid] < target) {
      left = mid + 1
    } else {
      right = mid - 1
    }
  }
  return false
}

/**
 * Extracts origin decoded URl.
 * @param url Chrome extension URl.
 * @param key Key.
 * @returns {string|*}
 */
export const extractDecodedOriginUrl = (url, key = 'originUrl') => {
  try {
    const [, params] = url.split('?')
    const searchParams = new URLSearchParams(params)
    const encodedHostname = searchParams.get(key)

    return window.atob(encodedHostname)
  } catch (error) {
    return null
  }
}
