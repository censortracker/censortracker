import validator from 'validator'

import { getBrowser } from '@/common/scripts/browser'

const currentBrowser = getBrowser()

const isExtensionUrl = (url) => {
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
      return atob(encodedUrl)
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

    return atob(encodedHostname)
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

/**
 * Simple element selector.
 * @param id Select by given ID.
 * @param query Select by given query.
 * @param cls Select by given class.
 * @param doc Document.
 * @returns {NodeListOf<*>|HTMLElement|HTMLCollectionOf<Element>}
 */
export const select = ({ id, query, cls, doc = document }) => {
  if (id) {
    return doc.getElementById(id)
  }

  if (cls) {
    return doc.getElementsByClassName(cls)
  }

  return doc.querySelectorAll(query)
}

/**
 * Translate given document.
 * @param doc Document to translate.
 * @param props Properties.
 */
export const translateDocument = (doc, props = {}) => {
  for (const element of select({ query: '[data-i18n-key]', doc })) {
    const value = element.getAttribute('data-i18n-key')
    // Extract value with the given name from "props".
    const renderProp = element.getAttribute('data-i18n-render-prop')

    let message = currentBrowser.i18n.getMessage(value)

    if (renderProp && Object.hasOwnProperty.call(props, renderProp)) {
      message = currentBrowser.i18n.getMessage(value, props[renderProp])
    }

    if (message) {
      element.innerHTML = message
    }
  }
}

export const validateArrayOfURLs = (urls) => {
  const result = new Set()

  for (const url of urls) {
    if (url !== '' && url.indexOf('.') !== -1) {
      let domain = url.replace(/^https?:\/\//, '').replace('www.', '')

      if (domain.indexOf('/') !== -1) {
        domain = domain.split('/', 1)
        result.add(domain)
      } else {
        result.add(domain)
      }
    }
  }
  return Array.from(result)
}
