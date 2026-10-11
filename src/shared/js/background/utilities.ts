import { getDomain, getPublicSuffix } from 'tldts'
import isURL from 'validator/lib/isURL'

import { normalizeHostname } from './hostname'

function startsWithExtension (string: string) {
  return /^(chrome|moz)-extension:/.test(string)
}

/**
 * Checks if passed value is a extension URL.
 * @param url URL to check.
 * @returns {boolean} true if valid, false otherwise.
 */
const isExtensionUrl = (url: unknown) => {
  return typeof url === 'string' &&
    (url.startsWith('about:') || startsWithExtension(url))
}

export const isOnionUrl = (url: string) => {
  return getPublicSuffix(url) === 'onion'
}

export const isI2PUrl = (url: string) => {
  return getPublicSuffix(url) === 'i2p'
}

/**
 * Validate passed URL using regex.
 * @param url URL to check.
 * @returns {boolean} true if valid otherwise false
 */
export const isValidURL = (url: string) => {
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
export const extractDomainFromUrl = (url: string) => {
  if (isExtensionUrl(url)) {
    const urlParams = url.split('?')[1]
    const searchParams = new URLSearchParams(urlParams)
    const encodedUrl = searchParams.get('loadFor')

    if (encodedUrl) {
      try {
        url = atob(encodedUrl)
      } catch (error) {
        return null
      }
    }
  }
  return getDomain(normalizeHostname(url)!)
}

export const extractHostnameFromUrl = (url: unknown) => {
  return normalizeHostname(url)
}

/**
 * Validate given array of URLs.
 * @param urls Array of urls.
 * @returns {Array[string]} Array of valid URLs.
 */
export const removeDuplicates = (urls: unknown[]) => {
  const result = new Set<string>()

  for (const url of urls) {
    const domain = normalizeHostname(
      typeof url === 'string' ? url.trim() : url,
    )

    if (domain) {
      result.add(domain)
    }
  }
  return Array.from(result)
}
