import DOMPurify from 'dompurify'
import { getDomain, getHostname, getPublicSuffix } from 'tldts'
import isURL from 'validator/lib/isURL'

import browser from './browser-api'
import { MILLISECONDS_IN_DAY } from './extension/base/config/constants'

function startsWithExtension (string) {
  return /^(chrome|moz)-extension:/.test(string)
}

/**
 * Checks if passed value is a extension URL.
 * @param url URL to check.
 * @returns {boolean} true if valid, false otherwise.
 */
const isExtensionUrl = (url) => {
  return url.startsWith('about:') || startsWithExtension(url)
}

export const isOnionUrl = (url) => {
  return getPublicSuffix(url) === 'onion'
}

export const isI2PUrl = (url) => {
  return getPublicSuffix(url) === 'i2p'
}

/**
 * Validate passed URL using regex.
 * @param url URL to check.
 * @returns {boolean} true if valid otherwise false
 */
export const isValidURL = (url) => {
  if (isOnionUrl(url) || isI2PUrl(url)) {
    return true
  }
  try {
    if (isExtensionUrl(url)) {
      return false
    }
    return isURL(url, {
      protocols: [
        'http',
        'https',
      ],
      validate_length: true,
    })
  } catch (error) {
    return false
  }
}

/**
 * Extract domain from the URL address.
 * @param url URL string.
 * @returns {string} Extracted domain.
 */
export const extractDomainFromUrl = (url) => {
  if (isExtensionUrl(url)) {
    const urlParams = url.split('?')[1]
    const searchParams = new URLSearchParams(urlParams)
    const encodedUrl = searchParams.get('loadFor')

    if (encodedUrl) {
      url = atob(encodedUrl)
    }
  }
  return getDomain(url)
}

export const extractHostnameFromUrl = (url) => {
  return getHostname(url)
}

export const i18nGetMessage = (key, props = {}) => {
  return browser.i18n.getMessage(key)
}

/**
 * Translate given document.
 * @param doc Document to translate.
 * @param props Properties.
 */
export const translateDocument = (doc, props = {}) => {
  for (const element of doc.querySelectorAll('[data-i18n-key]')) {
    const value = element.getAttribute('data-i18n-key')
    // Extract value with the given name from "props".
    const renderProp = element.getAttribute('data-i18n-render-prop')

    let message = browser.i18n.getMessage(value)

    if (renderProp && Object.hasOwnProperty.call(props, renderProp)) {
      message = browser.i18n.getMessage(value, props[renderProp])
    }

    if (message) {
      element.innerHTML = DOMPurify.sanitize(message)
    }
  }
}

/**
 * Validate given array of URLs.
 * @param urls Array of urls.
 * @returns {Array[string]} Array of valid URLs.
 */
export const removeDuplicates = (urls) => {
  const result = new Set()

  for (const url of urls) {
    const domain = getHostname(url)

    if (domain) {
      result.add(domain)
    }
  }
  return Array.from(result)
}

export const binaryContains = (array, target) => {
  if (!array) {
    return false
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
 * Extract name from icon path.
 * @param path path string.
 * @returns {string} name.
 */
export const getIconName = (path) => {
  const pattern = /([^/]+)\.png$/
  const match = path.match(pattern)

  if (match) {
    return match[1]
  }
  return undefined
}

export const removePrefix = (str, prefix) => {
  if (str.startsWith(prefix)) {
    return str.slice(prefix.length)
  }
  return str
}

export const countDays = (start, end) => {
  return Math.ceil((end - start) / MILLISECONDS_IN_DAY)
}

export const getDomainFontSize = (currentHostname) => {
  if (currentHostname?.length >= 22 && currentHostname?.length < 25) {
    return '17px'
  }
  if (currentHostname?.length > 25 && currentHostname?.length < 30) {
    return '15px'
  }
  if (currentHostname?.length >= 30) {
    return '13px'
  }
  return '20px'
}

export const processEncodedConfig = (encodedString) => {
  if (!encodedString) {
    return { err: 'emptyStringError' }
  }
  try {
    const requiredKeys = ['server', 'username', 'password', 'api_endpoint', 'api_key']
    const passedData = JSON.parse(atob(encodedString))
    const passedKeys = Object.keys(passedData)

    if (!requiredKeys.every((key) => passedKeys.includes(key))) {
      return { err: 'invalidJsonError' }
    }

    const {
      server: premiumProxyServerURI,
      username: premiumUsername,
      password: premiumPassword,
      api_endpoint: premiumBackendURL,
      api_key: premiumIdentificationCode,
      expiration_date: premiumExpirationDate,
    } = passedData

    return {
      data: {
        premiumProxyServerURI,
        premiumUsername,
        premiumPassword,
        premiumBackendURL,
        premiumIdentificationCode,
        premiumExpirationDate,
      },
    }
  } catch {
    return { err: 'parseJSONError' }
  }
}
