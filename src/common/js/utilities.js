import validator from 'validator'

/**
 * Validate passed URL using regex.
 * @param url URL
 * @returns {boolean} true if valid otherwise false
 */
export const isValidURL = (url) => {
  try {
    if (url.startsWith('about:') || url.startsWith('chrome-extension:')) {
      return false
    }
    return validator.isURL(url, { protocols: ['http', 'https'], validate_length: true })
  } catch (error) {
    return false
  }
}

/**
 * Extract URL from params.
 * @param url URL.
 * @returns {string|*}
 */
const extractURLFromQueryParams = (url) => {
  if (url.startsWith('moz-extension:') || url.startsWith('chrome-extension:')) {
    const urlParams = url.split('?')[1]
    const searchParams = new URLSearchParams(urlParams)
    const encodedUrl = searchParams.get('loadFor')

    return window.atob(encodedUrl)
  }
  return url
}

/**
 * Extract hostname from the URL address.
 * @param url URL string.
 * @returns {string} Extracted hostname.
 */
export const extractHostnameFromUrl = (url) => {
  url = extractURLFromQueryParams(url)

  url = url.trim().replace('www.', '')
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
 * Search for target in array using binary search.
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

/**
 * Checks if the string is URL starting with http(s).
 * @param string URL.
 * @returns {boolean} true or false.
 */
export const startsWithHttpHttps = (string) => {
  try {
    const url = new URL(string)
    const allowedProtocols = ['http:', 'https:']

    return allowedProtocols.includes(url.protocol)
  } catch (error) {
    return false
  }
}

/**
 * Check if the pattern with wildcard matches the domain.
 * @param pattern Pattern with wildcard.
 * @param domain Target domain
 * @returns {boolean} true or false
 */
export const matchDomainByWildcard = ({ pattern, domain }) => {
  if (pattern.endsWith('.*')) {
    pattern = `${pattern.slice(0, -2)}.[^.\\s]+`

    if (!pattern.startsWith('*.')) {
      pattern = `^${pattern}`
    }
  }

  if (pattern.startsWith('*.')) {
    pattern = `[^.\\s]+\\.${pattern.slice(2)}`
  }

  try {
    return new RegExp(pattern).test(domain)
  } catch (error) {
    return false
  }
}
