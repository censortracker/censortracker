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
 * Builds a PAC return token (e.g. "SOCKS5 1.2.3.4:1080") for a proxy. PAC uses
 * "PROXY" for plain HTTP proxies, while HTTPS/SOCKS4/SOCKS5 keep their names.
 * @param {string} protocol - Canonical protocol (HTTP/HTTPS/SOCKS4/SOCKS5).
 * @param {string} uri - "host:port".
 * @returns {string} PAC token.
 */
export const proxyToPacToken = (protocol, uri) => {
  const normalized = normalizeProxyProtocol(protocol) || 'HTTPS'
  const keyword = normalized === 'HTTP' ? 'PROXY' : normalized

  return `${keyword} ${uri}`
}

/**
 * Builds a PAC return string that tries each proxy in turn (failover).
 * @param {Array<{protocol: string, uri: string}>} proxies
 * @returns {string} PAC token list, or '' when nothing usable was given.
 */
export const proxyListToPacToken = (proxies) => {
  const tokens = (Array.isArray(proxies) ? proxies : [proxies])
    .filter((proxy) => proxy && proxy.protocol && proxy.uri)
    .map(({ protocol, uri }) => proxyToPacToken(protocol, uri))

  return tokens.length > 0 ? `${tokens.join('; ')};` : ''
}

/**
 * Splits a "host:port" proxy URI into its parts. IPv6 literals are accepted in
 * their bracketed form ("[::1]:1080"), which is how they must be written for
 * the port to be unambiguous.
 * @param {string} uri - "host:port".
 * @returns {{host: string, port: number}|null} Null when unparseable.
 */
export const splitHostPort = (uri) => {
  if (!uri || typeof uri !== 'string') {
    return null
  }

  const value = uri.trim()
  const bracketed = value.match(/^\[(.+)\]:(\d{1,5})$/)
  const host = bracketed ? bracketed[1] : value.slice(0, value.lastIndexOf(':'))
  const port = bracketed ? bracketed[2] : value.slice(value.lastIndexOf(':') + 1)

  if (!host || !/^\d{1,5}$/.test(port) || Number(port) > 65535) {
    return null
  }
  return { host, port: Number(port) }
}

/**
 * Percent-decodes one half of a credentials pair. Proxy lists routinely
 * URL-encode logins (an e-mail login arrives as "user%40example.com"), and the
 * browser expects the decoded value. A string that is not valid percent-encoding
 * is passed through untouched rather than dropped — a literal '%' in a password
 * is far more likely than a user meaning to encode something.
 * @param {string} value
 * @returns {string}
 */
const decodeCredentialPart = (value) => {
  if (!value) {
    return ''
  }

  try {
    return decodeURIComponent(value)
  } catch (error) {
    return value
  }
}

/**
 * Splits the stored "user:password" blob into the pair the browser's
 * authentication APIs expect.
 *
 * The split is on the FIRST colon: a colon is legal inside a password but not
 * inside a login, so everything after the first one belongs to the password.
 * Credentials are stored exactly as the user typed them (so sharing a proxy
 * round-trips losslessly) and decoded only here, on the way to the browser.
 * @param {string} credentials - Raw "user:password" (possibly percent-encoded).
 * @returns {{username: string, password: string}|null} Null when there is no
 *   usable login.
 */
export const splitProxyCredentials = (credentials) => {
  if (!credentials || typeof credentials !== 'string') {
    return null
  }

  const separator = credentials.indexOf(':')
  const username = decodeCredentialPart(
    separator === -1 ? credentials : credentials.slice(0, separator),
  )

  if (!username) {
    return null
  }

  return {
    username,
    password: separator === -1
      ? ''
      : decodeCredentialPart(credentials.slice(separator + 1)),
  }
}

/**
 * True when a proxy carries credentials that can only be delivered inside the
 * SOCKS handshake (as opposed to an HTTP 407 challenge).
 * @param {{protocol: string, credentials?: string}} proxy
 * @returns {boolean}
 */
export const needsSocksAuth = (proxy) => {
  if (!proxy || !proxy.credentials) {
    return false
  }
  const protocol = normalizeProxyProtocol(proxy.protocol)

  return protocol === 'SOCKS5' || protocol === 'SOCKS4'
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
export const parseProxyList = (
  text, defaultProtocol = 'HTTPS', { limit = Infinity } = {},
) => {
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
    // Stop as soon as the caller has what it asked for: a public list can hold
    // hundreds of thousands of entries, and building objects for all of them
    // when only a few thousand will be kept is pure waste.
    if (result.length >= limit) {
      break
    }

    const parsed = parseProxyString(token, defaultProtocol)

    if (!parsed) {
      continue
    }

    // Credentials are part of the key: the same address with a login is a
    // different proxy from the same address without one.
    const key =
      `${parsed.protocol}|${parsed.uri}|${parsed.credentials}`.toLowerCase()

    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    result.push(parsed)
  }
  return result
}

// Addresses that only mean something on the machine that wrote the PAC. A PAC
// published by a circumvention service routinely names a local client
// ("SOCKS5 localhost:9050" for Tor), and importing those as if they were
// servers would fill the list with entries that can never work here.
const LOCAL_PROXY_HOST = [
  /^localhost$/i,
  /\.local$/i,
  /^127\./,
  /^0\.0\.0\.0$/,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^169\.254\./,
  /^::1$/,
  /^f[cd][0-9a-f]{2}:/i,
  /^fe80:/i,
]

const isLocalProxyHost = (host) => {
  return LOCAL_PROXY_HOST.some((pattern) => pattern.test(host))
}

/**
 * Extracts the proxy servers named by a PAC script.
 *
 * A PAC is a program, not a list, so this deliberately does not try to
 * understand it: it scans for the return-token grammar every PAC shares
 * ("SOCKS5 1.2.3.4:1080", "PROXY host:port", …) wherever it appears, including
 * inside the string constants the script later returns. That is enough to
 * learn which servers a provider routes through without executing anything —
 * and executing it is not an option anyway, since the extension's content
 * security policy bars `new Function`.
 *
 * Local addresses are dropped unless asked for; see {@link isLocalProxyHost}.
 * @param {string} text - PAC script source.
 * @param {{includeLocal?: boolean}} [options]
 * @returns {Array<{protocol: string, uri: string, host: string, port: string,
 *   credentials: string}>} De-duplicated proxies, in order of appearance.
 */
export const parsePacProxies = (text, { includeLocal = false } = {}) => {
  if (!text || typeof text !== 'string') {
    return []
  }

  // PAC keywords, longest first so "SOCKS5" is never truncated to "SOCKS".
  const pattern =
    /\b(PROXY|HTTPS|SOCKS5|SOCKS4|SOCKS)\s+([a-zA-Z0-9._-]+|\[[0-9a-fA-F:]+\]):(\d{1,5})\b/g
  const seen = new Set()
  const proxies = []

  for (const [, keyword, host, port] of text.matchAll(pattern)) {
    // PAC spells a plain HTTP proxy "PROXY"; everything else keeps its name.
    const protocol =
      normalizeProxyProtocol(keyword === 'PROXY' ? 'HTTP' : keyword)

    if (!protocol || Number(port) > 65535 || Number(port) === 0) {
      continue
    }
    if (!includeLocal && isLocalProxyHost(host.replace(/^\[|\]$/g, ''))) {
      continue
    }

    const uri = `${host}:${port}`
    const key = `${protocol}|${uri}`.toLowerCase()

    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    proxies.push({ protocol, uri, host, port, credentials: '' })
  }

  return proxies
}

/**
 * True when a fetched source is a PAC script rather than a plain proxy list.
 * The entry point is mandated by the format, which makes it a reliable marker.
 * @param {string} text
 * @returns {boolean}
 */
export const looksLikePacScript = (text) => {
  return typeof text === 'string' && /function\s+FindProxyForURL/.test(text)
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
      try {
        const decoded = atob(encodedUrl)

        // `atob` throws on malformed input, and the decoded value only makes
        // sense as an http(s) URL — anything else is a crafted parameter and
        // is ignored rather than parsed as a domain.
        if (/^https?:\/\//i.test(decoded)) {
          url = decoded
        }
      } catch (error) {
        console.warn('[URL] Ignoring malformed «loadFor» parameter.')
      }
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
