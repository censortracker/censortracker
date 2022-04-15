import validator from 'validator'

export const isExtensionUrl = (url) => {
  return url.startsWith('about:') ||
      url.startsWith('moz-extension:') ||
      url.startsWith('chrome-extension:')
}

/**
 * Validate passed URL using regex.
 * @param url URL
 * @returns {boolean} true if valid otherwise false
 */
export const isValidURL = (url) => {
  try {
    if (isExtensionUrl(url)) {
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
  if (isExtensionUrl(url)) {
    const urlParams = url.split('?')[1]
    const searchParams = new URLSearchParams(urlParams)
    const encodedUrl = searchParams.get('loadFor')

    if (encodedUrl) {
      return window.atob(encodedUrl)
    }
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
 * Get UNIX timestamp
 */
export const timestamp = () => {
  return Math.floor(Date.now() / 1000)
}
