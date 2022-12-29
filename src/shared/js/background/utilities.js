import { getDomain, getHostname, getPublicSuffix } from 'tldts'
import isURL from 'validator/lib/isURL'

import Browser from './browser-api'

/**
 * Checks if passed value is a extension URL.
 * @param url URL to check.
 * @returns {boolean} true if valid, false otherwise.
 */
const isExtensionUrl = (url) => {
  return url.startsWith('about:') ||
    url.startsWith('moz-extension:') ||
    url.startsWith('chrome-extension:')
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
    return isURL(url, { protocols: ['http', 'https'], validate_length: true })
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
  return Browser.i18n.getMessage(key)
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

    let message = Browser.i18n.getMessage(value)

    if (renderProp && Object.hasOwnProperty.call(props, renderProp)) {
      message = Browser.i18n.getMessage(value, props[renderProp])
    }

    if (message) {
      element.innerHTML = message
    }
  }
}

/**
 * Validate given array of URLs.
 * @param urls Array of urls.
 * @returns {Array[string]} Array of valid URLs.
 */
export const parseURLStrings = (urls) => {
  const result = new Set()

  for (const url of urls) {
    const domain = getDomain(url)

    if (domain) {
      result.add(domain)
    }
  }
  return Array.from(result)
}
