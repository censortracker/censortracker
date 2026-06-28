import { getDomain, getHostname, getPublicSuffix } from 'tldts'
import isURL from 'validator/lib/isURL'

import browser from './browser-api'

/**
 * Like `fetch`, but aborts the request after `timeout` ms so a dead/slow
 * proxy or backend can never hang background tasks or the popup forever.
 * @param {string} resource - URL to fetch.
 * @param {object} [options] - Standard fetch options.
 * @param {number} [options.timeout=8000] - Timeout in milliseconds.
 * @returns {Promise<Response>}
 */
export const fetchWithTimeout = async (resource, { timeout = 8000, ...options } = {}) => {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)

  try {
    return await fetch(resource, { ...options, signal: controller.signal })
  } finally {
    clearTimeout(id)
  }
}

const PROXY_PROTOCOLS = ['SOCKS5', 'SOCKS4', 'HTTPS', 'HTTP']

/**
 * Normalizes an arbitrary protocol token to one understood by PAC scripts.
 * @param {string} protocol - User-supplied protocol (e.g. "socks5", "https").
 * @returns {string|null} A canonical PAC protocol or null when unknown.
 */
export const normalizeProxyProtocol = (protocol) => {
  if (!protocol) {
    return null
  }

  const normalized = protocol.trim().toUpperCase().replace(/[:/]+$/, '')

  if (normalized === 'SOCKS') {
    return 'SOCKS5'
  }
  return PROXY_PROTOCOLS.includes(normalized) ? normalized : null
}

/**
 * Parses a free-form proxy string into a protocol + server URI pair so the
 * user can paste a proxy in almost any common format, e.g.:
 *   socks5://user:pass@1.2.3.4:1080
 *   https://proxy.example.com:8443
 *   1.2.3.4:1080            (protocol falls back to the provided default)
 *
 * @param {string} input - Raw proxy string.
 * @param {string} [defaultProtocol='HTTPS'] - Protocol when none is present.
 * @returns {{protocol: string, uri: string, host: string, port: string,
 *   credentials: string}|null} Parsed parts, or null when the input is invalid.
 */
export const parseProxyString = (input, defaultProtocol = 'HTTPS') => {
  if (!input || typeof input !== 'string') {
    return null
  }

  let rest = input.trim()
  let protocol = normalizeProxyProtocol(defaultProtocol) || 'HTTPS'

  const schemeMatch = rest.match(/^([a-zA-Z][a-zA-Z0-9+.-]*):\/\//)

  if (schemeMatch) {
    const parsedProtocol = normalizeProxyProtocol(schemeMatch[1])

    if (parsedProtocol) {
      protocol = parsedProtocol
    }
    rest = rest.slice(schemeMatch[0].length)
  }

  // Strip a trailing path/query if the user pasted a full URL.
  rest = rest.split('/')[0]

  let credentials = ''

  if (rest.includes('@')) {
    const atIndex = rest.lastIndexOf('@')

    credentials = rest.slice(0, atIndex)
    rest = rest.slice(atIndex + 1)
  }

  const lastColon = rest.lastIndexOf(':')

  if (lastColon === -1) {
    return null
  }

  const host = rest.slice(0, lastColon).trim()
  const port = rest.slice(lastColon + 1).trim()

  if (!host || !/^\d{1,5}$/.test(port) || Number(port) > 65535) {
    return null
  }

  // PAC return strings cannot carry credentials, so the server URI excludes
  // them; the credentials are preserved separately for reference.
  return {
    protocol,
    host,
    port,
    credentials,
    uri: `${host}:${port}`,
  }
}

/**
 * Serializes a proxy into the shareable string consumed by
 * {@link parseProxyString}, so copy → paste round-trips losslessly (including
 * credentials), e.g. "socks5://user:pass@1.2.3.4:1080".
 * @param {{protocol: string, uri: string, credentials?: string}} proxy
 * @returns {string} The shareable proxy string, or '' when incomplete.
 */
export const formatProxyForShare = ({ protocol, uri, credentials = '' } = {}) => {
  if (!protocol || !uri) {
    return ''
  }

  const auth = credentials ? `${credentials}@` : ''

  return `${protocol.toLowerCase()}://${auth}${uri}`
}

/**
 * Parses a whitespace/comma/semicolon/newline separated blob of proxy strings
 * (e.g. pasted from the clipboard) into a de-duplicated list of parsed proxies.
 * @param {string} text - Raw text containing zero or more proxy strings.
 * @param {string} [defaultProtocol='HTTPS'] - Protocol when none is present.
 * @returns {Array<{protocol: string, uri: string, host: string, port: string,
 *   credentials: string}>}
 */
export const parseProxyList = (text, defaultProtocol = 'HTTPS') => {
  if (!text || typeof text !== 'string') {
    return []
  }

  const tokens = text
    .split(/[\s,;]+/)
    .map((token) => token.trim())
    .filter(Boolean)

  const seen = new Set()
  const result = []

  for (const token of tokens) {
    const parsed = parseProxyString(token, defaultProtocol)

    if (!parsed) {
      continue
    }

    const key = `${parsed.protocol}|${parsed.uri}`.toLowerCase()

    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(parsed)
  }
  return result
}

/**
 * Resolves a promise with a fallback value if it doesn't settle in time.
 * Useful to keep the UI responsive when a background check might hang.
 * @param {Promise<*>} promise - Promise to guard.
 * @param {number} ms - Timeout in milliseconds.
 * @param {*} fallback - Value to resolve with on timeout.
 * @returns {Promise<*>}
 */
export const withTimeout = (promise, ms, fallback) => {
  return Promise.race([
    Promise.resolve(promise).catch(() => fallback),
    new Promise((resolve) => setTimeout(() => resolve(fallback), ms)),
  ])
}

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
      element.innerHTML = message
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
    const domain = getDomain(url)

    if (domain) {
      result.add(domain)
    }
  }
  return Array.from(result)
}
