import browser from './browser-api'
import {
  buildIgnoreIndex,
  isIgnoredHost,
  isPrivateHost,
  toPunycode,
} from './host-rules'
import { resolveProxyForHost } from './site-rules'
import {
  needsSocksAuth,
  normalizeProxyProtocol,
  splitHostPort,
  splitProxyCredentials,
} from './utilities'

/**
 * Proxy authentication (login + password).
 *
 * A PAC script can only ever name a proxy — its return strings have no room for
 * credentials — so the login and password the user typed have to reach the
 * browser through a separate channel. There are two such channels, and which
 * one applies depends on the proxy protocol:
 *
 *   - HTTP/HTTPS proxies challenge with a `407 Proxy Authentication Required`,
 *     which surfaces as `webRequest.onAuthRequired`. Both browsers support it
 *     (Chromium needs the `webRequestAuthProvider` permission, Firefox needs
 *     `webRequestBlocking`).
 *   - SOCKS proxies negotiate credentials inside the SOCKS handshake, long
 *     before any HTTP traffic exists, so no 407 is ever emitted and
 *     `onAuthRequired` never fires. Firefox exposes them through
 *     `proxy.onRequest`; Chromium exposes nothing at all, which is why SOCKS
 *     credentials are unsupported there and the settings page says so.
 */

// ---------------------------------------------------------------------------
// Credential registry
// ---------------------------------------------------------------------------

// host:port -> { id, username, password }. Cached because onAuthRequired is on
// the critical path of every proxied request and a storage round-trip per
// challenge would be felt.
let credentialsByEndpoint = null

const endpointKey = (host, port) => `${String(host).toLowerCase()}:${port}`

/**
 * Rebuilds the endpoint -> credentials map from the stored proxy list.
 * @returns {Promise<Map<string, {id: string, username: string,
 *   password: string}>>}
 */
const loadCredentials = async () => {
  const { customProxies } =
    await browser.storage.local.get({ customProxies: [] })
  const index = new Map()

  for (const proxy of customProxies) {
    if (!proxy || !proxy.credentials || !proxy.uri) {
      continue
    }

    const endpoint = splitHostPort(proxy.uri)
    const credentials = splitProxyCredentials(proxy.credentials)

    if (!endpoint || !credentials) {
      continue
    }

    // First one wins: two entries for the same endpoint with different logins
    // are indistinguishable once the browser challenges us, since the challenge
    // names only the proxy.
    const key = endpointKey(endpoint.host, endpoint.port)

    if (!index.has(key)) {
      index.set(key, { id: proxy.id, ...credentials })
    }
  }

  credentialsByEndpoint = index
  return index
}

const getCredentials = async () => {
  return credentialsByEndpoint || loadCredentials()
}

/**
 * Drops the cached credentials so the next challenge re-reads them. Called
 * whenever the stored proxy list changes.
 */
export const invalidateCredentialsCache = () => {
  credentialsByEndpoint = null
}

/**
 * `storage.onChanged` listener: keeps the cache honest when the proxy list is
 * edited, including from the settings page in another context.
 * @param {object} changes
 */
export const handleCredentialsChange = (changes) => {
  if (changes && changes.customProxies) {
    invalidateCredentialsCache()
  }
}

// ---------------------------------------------------------------------------
// Rejected credentials
// ---------------------------------------------------------------------------

// Endpoints that answered a second challenge after we supplied credentials,
// i.e. the login or password is wrong. Kept in memory only: it is a hint for
// the UI ("needs auth" rather than "dead"), not a fact worth persisting, and a
// service-worker restart should let the user's next attempt start clean.
const rejectedEndpoints = new Set()

/**
 * True when the credentials stored for this proxy were rejected by the proxy
 * itself. Lets a liveness check report "needs authorization" instead of
 * mislabelling a reachable proxy as dead.
 * @param {string} uri - "host:port".
 * @returns {boolean}
 */
export const wasAuthRejected = (uri) => {
  const endpoint = splitHostPort(uri)

  return endpoint
    ? rejectedEndpoints.has(endpointKey(endpoint.host, endpoint.port))
    : false
}

/**
 * Forgets a rejected endpoint, so editing the credentials gives the proxy a
 * clean slate on the next check.
 * @param {string} uri - "host:port".
 */
export const clearAuthRejection = (uri) => {
  const endpoint = splitHostPort(uri)

  if (endpoint) {
    rejectedEndpoints.delete(endpointKey(endpoint.host, endpoint.port))
  }
}

// ---------------------------------------------------------------------------
// onAuthRequired (HTTP / HTTPS proxies)
// ---------------------------------------------------------------------------

// requestId -> { attempts, ts }. The browser re-fires onAuthRequired for the
// same request when the credentials we returned were refused; answering with
// the same wrong pair forever would spin. Entries are pruned by age because
// there is no event that reliably marks the end of a *failed* authentication.
const attemptsByRequest = new Map()
const ATTEMPT_TTL = 60000

const pruneAttempts = (now) => {
  for (const [requestId, entry] of attemptsByRequest) {
    if (now - entry.ts > ATTEMPT_TTL) {
      attemptsByRequest.delete(requestId)
    }
  }
}

const countAttempt = (requestId) => {
  const now = Date.now()

  pruneAttempts(now)

  const entry = attemptsByRequest.get(requestId)

  if (!entry) {
    attemptsByRequest.set(requestId, { attempts: 1, ts: now })
    return 1
  }

  entry.attempts += 1
  entry.ts = now
  return entry.attempts
}

/**
 * Answers a proxy's authentication challenge with the credentials stored for
 * that exact proxy.
 *
 * Two refusals are deliberate and load-bearing:
 *
 *   - A challenge that is NOT from a proxy is never answered. Any website can
 *     reply `401` and would otherwise be handed the user's proxy login.
 *   - A challenge from a host that is not one of the user's configured proxies
 *     is never answered, so a hostile proxy inserted into the path cannot ask
 *     for someone else's credentials.
 *
 * @param {object} details - `webRequest.onAuthRequired` details.
 * @returns {Promise<object>} `{authCredentials}` or `{}` to let the browser
 *   fall back to its own prompt.
 */
const answerWith = (key, credentials, requestId) => {
  if (!credentials) {
    return {}
  }

  // Second time round for the same request means what we sent was refused.
  if (countAttempt(requestId) > 1) {
    rejectedEndpoints.add(key)
    console.warn(`Proxy rejected the stored credentials for ${key}.`)
    return {}
  }

  rejectedEndpoints.delete(key)
  return {
    authCredentials: {
      username: credentials.username,
      password: credentials.password,
    },
  }
}

/**
 * Answers immediately, or returns null when the credentials are not in memory
 * yet and the caller has to fall back to the asynchronous path.
 *
 * Answering without awaiting anything is what makes this work at all. A
 * challenge is a blocking event: the browser holds the connection while the
 * listener decides, and a reply that arrives after a trip to storage is late
 * often enough to lose the request.
 * @param {object} details
 * @returns {object|null}
 */
export const answerProxyAuthSync = (details) => {
  if (!details || !details.isProxy || !details.challenger) {
    return {}
  }
  if (!credentialsByEndpoint) {
    return null
  }

  const key = endpointKey(details.challenger.host, details.challenger.port)

  return answerWith(key, credentialsByEndpoint.get(key), details.requestId)
}

export const handleProxyAuthRequired = async (details) => {
  if (!details || !details.isProxy || !details.challenger) {
    return {}
  }

  const key = endpointKey(details.challenger.host, details.challenger.port)

  return answerWith(key, (await getCredentials()).get(key), details.requestId)
}

// ---------------------------------------------------------------------------
// proxy.onRequest (SOCKS proxies, Firefox only)
// ---------------------------------------------------------------------------

// Everything `FindProxyForURL` decides from, mirrored so the onRequest listener
// reaches the same verdict as the PAC it stands in for. Kept in sync by
// ProxyManager, which sets it wherever it installs a PAC.
let snapshot = null

/**
 * Records the routing the PAC was just built from, so the SOCKS path can
 * reproduce it. `testRoutes` maps a host to the proxies it must go through
 * regardless of the rules (used by the checker and by source fetching).
 * @param {{proxies: Array, proxyAll: boolean, domains: Array<string>,
 *   countries: Array<string>, rules: Object, ignoredHosts: Array<string>,
 *   testRoutes: Object<string, Array>}} [next] - Null clears it.
 */
export const setRoutingSnapshot = (next) => {
  if (!next) {
    snapshot = null
    return
  }

  const blocklist = new Set(
    (next.domains || [])
      .map((domain) => toPunycode(domain).toLowerCase())
      .filter(Boolean),
  )

  snapshot = {
    proxies: next.proxies || [],
    proxyAll: !!next.proxyAll,
    countries: next.countries || [],
    rules: next.rules || {},
    testRoutes: next.testRoutes || null,
    ignoredHosts: buildIgnoreIndex(next.ignoredHosts),
    isBlocked: (candidate) => {
      return blocklist.has(toPunycode(candidate).toLowerCase())
    },
  }
}

const FIREFOX_PROXY_TYPES = {
  SOCKS5: 'socks',
  SOCKS4: 'socks4',
  HTTPS: 'https',
  HTTP: 'http',
}

/**
 * Converts one of our proxies into the descriptor Firefox's proxy API expects.
 *
 * Credentials are attached for SOCKS only. An HTTP/HTTPS proxy authenticates
 * over 407 instead, which `handleProxyAuthRequired` already covers — putting
 * them here as well would be ignored at best.
 * @param {{protocol: string, uri: string, credentials?: string}} proxy
 * @returns {object|null}
 */
const toFirefoxProxyInfo = (proxy) => {
  const endpoint = splitHostPort(proxy && proxy.uri)
  const protocol = normalizeProxyProtocol(proxy && proxy.protocol)

  if (!endpoint || !protocol) {
    return null
  }

  const info = {
    type: FIREFOX_PROXY_TYPES[protocol],
    host: endpoint.host,
    port: endpoint.port,
  }

  // Resolve names at the proxy: doing it locally would leak the very lookups
  // the proxy is there to hide, and cannot resolve .onion/.i2p at all.
  //
  // This is set for EVERY SOCKS5 hop, not only the ones carrying a login. The
  // listener is attached as soon as any one proxy in the chain needs SOCKS
  // authentication, and from then on it answers for all of them — so a hop
  // without credentials used to travel this path with `proxyDNS` left at its
  // default of false and resolve names on this machine, while the very same
  // proxy resolved them remotely whenever the PAC was driving instead.
  //
  // SOCKS4 is deliberately left alone: it cannot carry a hostname, and asking
  // Firefox to send one turns the connection into SOCKS4a, which a plain
  // SOCKS4 proxy does not answer.
  if (protocol === 'SOCKS5') {
    info.proxyDNS = true
  }

  if (needsSocksAuth(proxy)) {
    const credentials = splitProxyCredentials(proxy.credentials)

    if (credentials) {
      info.username = credentials.username
      info.password = credentials.password
    }
  }
  return info
}

const DIRECT = { type: 'direct' }

const hostOfUrl = (url) => {
  try {
    // An IPv6 hostname arrives bracketed; the routing rules match the literal.
    return new URL(url).hostname.replace(/^\[|\]$/g, '')
  } catch (error) {
    return ''
  }
}

/**
 * Firefox `proxy.onRequest` listener: the SOCKS-authenticating equivalent of
 * the generated PAC. Returns the full failover order so a dead first hop still
 * falls through to the rest, exactly as the PAC's rotation string does.
 * @param {object} details - Request details.
 * @returns {object|Array<object>}
 */
export const handleProxyRequest = (details) => {
  if (!snapshot) {
    return DIRECT
  }

  const host = hostOfUrl(details.url)

  if (!host) {
    return DIRECT
  }

  // Ahead of everything, as in the PAC: a local address is not reachable
  // through a proxy, and an ignored one was asked to stay off it.
  if (isPrivateHost(host) || isIgnoredHost(host, snapshot.ignoredHosts)) {
    return DIRECT
  }

  // Checker and source-fetch routes win outright, matched on the full host.
  if (snapshot.testRoutes &&
      Object.prototype.hasOwnProperty.call(snapshot.testRoutes, host)) {
    const forced = snapshot.testRoutes[host]
      .map(toFirefoxProxyInfo)
      .filter(Boolean)

    return forced.length > 0 ? forced : DIRECT
  }

  const outcome = resolveProxyForHost(host, snapshot)

  if (!outcome.proxied) {
    return DIRECT
  }

  const infos = outcome.chain.map(toFirefoxProxyInfo).filter(Boolean)

  // Never append a direct fallback: silently sending traffic in the clear is
  // the one outcome a censorship-circumvention tool must not produce.
  return infos.length > 0 ? infos : DIRECT
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

let socksRoutingActive = false

/**
 * Turns the SOCKS-authenticating routing path on or off.
 *
 * The listener is only attached while it is actually needed — a chain with a
 * SOCKS proxy that has credentials — so in every other case routing stays on
 * the well-trodden PAC path and this feature cannot regress it. Firefox falls
 * back to the proxy settings (our PAC) whenever no listener claims a request,
 * so detaching restores the previous behaviour exactly.
 * @param {boolean} enabled
 */
export const setSocksAuthRouting = (enabled) => {
  if (!browser.isFirefox || !browser.proxy || !browser.proxy.onRequest) {
    return
  }

  if (enabled && !socksRoutingActive) {
    browser.proxy.onRequest.addListener(
      handleProxyRequest, { urls: ['<all_urls>'] },
    )
    socksRoutingActive = true
    console.log('SOCKS authentication routing enabled.')
  } else if (!enabled && socksRoutingActive) {
    browser.proxy.onRequest.removeListener(handleProxyRequest)
    socksRoutingActive = false
    console.log('SOCKS authentication routing disabled.')
  }
}

/**
 * True when this browser can deliver SOCKS credentials at all. Chromium cannot:
 * it offers no hook into the SOCKS handshake, and its `onAuthRequired` fires
 * only for HTTP-level challenges.
 * @returns {boolean}
 */
export const supportsSocksAuth = () => {
  return !!(browser.isFirefox && browser.proxy && browser.proxy.onRequest)
}

/**
 * Subscribes to proxy authentication challenges.
 *
 * The two browsers need different listener shapes: Firefox resolves a promise
 * returned from a `blocking` listener, while Chromium requires `asyncBlocking`
 * and a callback. Both need to read storage, so neither can be synchronous.
 * @returns {boolean} False when the browser doesn't expose the API.
 */
export const registerProxyAuthHandler = () => {
  if (!browser.webRequest || !browser.webRequest.onAuthRequired) {
    console.warn('webRequest.onAuthRequired unavailable: proxies that ' +
      'require a login will fall back to the browser\'s own prompt.')
    return false
  }

  const filter = { urls: ['<all_urls>'] }

  // Start loading the credentials now, so a challenge that arrives later can
  // be answered straight from memory rather than after a storage round-trip.
  loadCredentials().catch(() => {})

  try {
    if (browser.isFirefox) {
      browser.webRequest.onAuthRequired.addListener(
        (details) => answerProxyAuthSync(details) ||
          handleProxyAuthRequired(details),
        filter,
        ['blocking'],
      )
    } else {
      browser.webRequest.onAuthRequired.addListener(
        (details, callback) => {
          const immediate = answerProxyAuthSync(details)

          if (immediate) {
            callback(immediate)
            return
          }
          handleProxyAuthRequired(details).then(callback, () => callback({}))
        },
        filter,
        ['asyncBlocking'],
      )
    }
    return true
  } catch (error) {
    // Chromium refuses a blocking listener without `webRequestAuthProvider`.
    // Failing loudly but harmlessly beats taking the whole worker down.
    console.error(`Could not subscribe to proxy authentication: ${error}`)
    return false
  }
}
