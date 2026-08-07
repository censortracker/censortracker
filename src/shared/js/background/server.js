import { getDomain } from 'tldts'

import browser from './browser-api'
import { fetchWithTimeout, removeDuplicates } from './utilities'

const getConfigAPIEndpoints = () => {
  return [
    {
      endpointName: 'GitHub',
      endpointUrl: 'https://raw.githubusercontent.com/censortracker/ctconf/main/config.json',
    },
    {
      endpointName: 'jsDelivr',
      endpointUrl: 'https://cdn.jsdelivr.net/gh/censortracker/ctconf/config.json',
    },
    {
      endpointName: 'Google',
      endpointUrl: 'https://storage.googleapis.com/censortracker/config.json',
    },
  ]
}

const FALLBACK_COUNTRY_CODE = 'RU'

const isNonEmptyString = (value) => {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Accepts both `8080` and `"8080"` — mirrors differ on whether ports are
 * serialized as numbers or strings.
 * @param value {*} Candidate port.
 * @returns {boolean} True when the value is a valid TCP port.
 */
const isUsablePort = (value) => {
  const port = Number(value)

  return Number.isInteger(port) && port > 0 && port <= 65535
}

/**
 * Fetches the country code from the given GeoIP API Endpoint.
 * @param geoIPServiceURL {string} API endpoint for fetching country code.
 * @returns {Promise<string|*>} Resolves with the country code.
 */
const inquireCountryCode = async (geoIPServiceURL) => {
  try {
    const response = await fetchWithTimeout(geoIPServiceURL, { timeout: 5000 })
    const { countryCode } = await response.json()

    return countryCode
  } catch (error) {
    console.error('[GeoIP] Error on fetching country code. Using fallback.')
    return FALLBACK_COUNTRY_CODE
  }
}

/**
 * Downloads and validates the config from a single mirror.
 * @param endpointName {string} Human-readable mirror name.
 * @param endpointUrl {string} Mirror URL.
 * @returns {Promise<{}|null>} Parsed payload, or `null` when the mirror is
 *   unreachable or answered with something unusable.
 */
const fetchConfigFromEndpoint = async ({ endpointName, endpointUrl }) => {
  try {
    const response = await fetchWithTimeout(endpointUrl, { timeout: 8000 })

    if (!response.ok) {
      console.error(`[Config] Error on fetching config from: ${endpointName}`)
      return null
    }

    const payload = await response.json()

    if (!payload || typeof payload !== 'object') {
      console.warn(`[Config] Invalid config shape from ${endpointName}.`)
      return null
    }

    const { meta = {}, data = [] } = payload

    // Only object entries are usable: the caller reads `countryCode` off them
    // and stamps debug fields onto the winner.
    const entries = Array.isArray(data)
      ? data.filter((cfg) => cfg && typeof cfg === 'object')
      : []

    if (entries.length === 0) {
      console.log(`[Config] Skipping ${endpointName}...`)
      return null
    }

    return { meta, data: entries, endpointName, endpointUrl }
  } catch (error) {
    console.error(
      `[Config] Failed to fetch config from ${endpointName}: ${error}`,
    )
    return null
  }
}

/**
 * Fetches config from the server.
 *
 * Every mirror is probed in parallel, so one unreachable endpoint no longer
 * costs a full 8s timeout before the next one is even tried. The winner is
 * still picked by endpoint *priority* rather than by whoever answers first —
 * a slow GitHub beats a fast Google, exactly as in the sequential version.
 *
 * Side effects (the GeoIP lookup and every storage write) are deferred until
 * a winner is known, so the losing mirrors can neither race each other into
 * storage nor trigger a GeoIP request each.
 * @returns {Promise<{}|*>} Resolves with the config.
 */
const fetchConfig = async () => {
  const { currentRegionCode } = await browser.storage.local.get({
    currentRegionCode: '',
  })

  const settled = await Promise.allSettled(
    getConfigAPIEndpoints().map(fetchConfigFromEndpoint),
  )

  // `Promise.allSettled` preserves input order, so the first fulfilled,
  // non-null entry is the highest-priority mirror that actually worked.
  const winner = settled.find(
    (result) => result.status === 'fulfilled' && result.value,
  )

  if (!winner) {
    return {}
  }

  const { meta, data, endpointName, endpointUrl } = winner.value

  let countryCode = FALLBACK_COUNTRY_CODE

  if (currentRegionCode) {
    countryCode = currentRegionCode
  } else if (meta.geoIPServiceURL) {
    countryCode = await inquireCountryCode(meta.geoIPServiceURL)
  }

  const matched = data.find((cfg) => cfg.countryCode === countryCode)
  // The selected country isn't supported by this config: fall back to the
  // first available entry instead of crashing on `undefined`.
  const config = matched || data[0]

  await browser.storage.local.set({ unsupportedCountry: !matched })

  // For debugging purposes
  config.configEndpointUrl = endpointUrl
  config.configEndpointSource = endpointName

  await browser.storage.local.set({
    localConfig: config,
    backendIsIntermittent: false,
  })

  return config
}

/**
 * Fetches available config to connect to the proxy server.
 * @param proxyUrl {string} API endpoint for fetching proxy config.
 * @returns {Promise<void>} Resolves when the config is fetched.
 */
const fetchProxy = async ({ proxyUrl } = {}) => {
  if (!proxyUrl) {
    console.warn('[Proxy] «proxyUrl» is not present in config.')
    return
  }

  const { badProxies } = await browser.storage.local.get({ badProxies: [] })

  console.group('[Proxy] Fetching proxy...')

  try {
    if (badProxies.length > 0) {
      const params = new URLSearchParams()

      for (const badProxy of badProxies) {
        params.append('exclude', badProxy)
      }

      proxyUrl += `?${params.toString()}`

      console.log('Excluding bad proxies:')
      console.table(badProxies)
    }

    const response = await fetchWithTimeout(proxyUrl, { timeout: 8000 })
    const payload = await response.json()

    if (!payload || typeof payload !== 'object') {
      throw new Error('response is not a JSON object')
    }

    const {
      server,
      port,
      pingHost,
      pingPort,
      fallbackReason,
    } = payload

    // Without this an error payload (or an HTML captive-portal page) would be
    // happily stored as the literal proxy URI "undefined:undefined" and then
    // handed to the PAC script.
    if (!isNonEmptyString(server) || !isUsablePort(port)) {
      throw new Error(`unusable proxy config: ${server}:${port}`)
    }

    const fallbackProxyInUse = !!fallbackReason

    console.log(`Status: ${response.status}`)

    // The ping endpoint is optional: when it is missing or malformed we keep
    // the URI empty rather than storing "undefined:undefined".
    const proxyPingURI = isNonEmptyString(pingHost) && isUsablePort(pingPort)
      ? `${pingHost}:${pingPort}`
      : ''
    const proxyServerURI = `${server}:${port}`

    console.log(`Proxy server fetched: ${proxyServerURI}!`)

    if (fallbackProxyInUse) {
      console.warn(`Using fallback «${proxyServerURI}» for the reason: ${fallbackReason}`)
    } else {
      await browser.storage.local.set({ proxyIsAlive: true })
      await browser.storage.local.remove([
        'fallbackReason',
        'fallbackProxyInUse',
        'fallbackProxyError',
      ])
    }

    await browser.storage.local.set({
      proxyPingURI,
      proxyServerURI,
      currentProxyServer: server,
      fallbackReason,
      fallbackProxyInUse,
      proxyLastFetchTs: Date.now(),
    })
  } catch (error) {
    console.error(
      `Error on fetching proxy server: ${error}`,
    )
  }
  console.groupEnd()
}

/**
 * Parses a registry response that may come in several formats:
 *   - a JSON array of domain strings: ["example.com", "foo.org"]
 *   - a JSON array of objects:        [{ "domain": "example.com" }, ...]
 *   - a JSON object with a "domains"/"data" array
 *   - a plain-text list separated by new lines, commas or spaces
 *
 * This makes it possible to point the extension at any mirror of the
 * blocklist when the default source is unavailable.
 * @param {string} text - Raw response body.
 * @returns {string[]} List of domains.
 */
export const parseRegistryData = (text) => {
  const trimmed = (text || '').trim()

  if (!trimmed) {
    return []
  }

  // Try JSON first.
  try {
    const parsed = JSON.parse(trimmed)
    let list = parsed

    if (!Array.isArray(parsed)) {
      list = parsed.domains || parsed.data || parsed.result || []
    }

    if (Array.isArray(list)) {
      return list
        .map((item) => {
          if (typeof item === 'string') {
            return item
          }
          return item && (item.domain || item.url || item.host || item.name)
        })
        .filter(Boolean)
    }
  } catch (error) {
    // Not JSON — fall through to plain-text parsing.
  }

  // Plain text: split on new lines, commas, semicolons or whitespace.
  return trimmed
    .split(/[\s,;]+/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'))
}

/**
 * Fetches database of blocked websites from registry.
 *
 * If the user configured a custom registry source (see advanced options) it
 * takes priority over the URL provided by the remote config, which lets the
 * extension keep working when the default registry endpoint is down.
 * @param registryUrl Registry URL (from remote config).
 * @param specifics Specific attributes.
 * @returns {Promise<void>} Resolves when the database is fetched.
 */
const fetchRegistry = async ({ registryUrl, specifics = {} } = {}) => {
  const {
    customRegistryUrl,
    useCustomRegistry,
  } = await browser.storage.local.get({
    customRegistryUrl: '',
    useCustomRegistry: false,
  })

  const effectiveRegistryUrl =
    useCustomRegistry && customRegistryUrl ? customRegistryUrl : registryUrl

  if (!effectiveRegistryUrl) {
    console.warn('[Registry] «registryUrl» is not present in config.')
    return
  }

  console.log(`[Registry] Fetching registry from ${effectiveRegistryUrl}...`)

  // Fetch the blocklist itself, tolerating multiple response formats.
  try {
    const response = await fetchWithTimeout(effectiveRegistryUrl, { timeout: 15000 })
    const text = await response.text()
    const domains = removeDuplicates(parseRegistryData(text))

    console.log(`Fetched ${domains.length} domains from: ${effectiveRegistryUrl}`)

    if (domains.length > 0) {
      await browser.storage.local.set({ domains })
    } else {
      console.warn('[Registry] Parsed an empty domain list, keeping previous one.')
    }
  } catch (error) {
    console.error(`Error on fetching data from: ${effectiveRegistryUrl}: ${error}`)
  }

  // Disseminators (ORI) list is country-specific and always JSON.
  if ('cooperationRefusedORIUrl' in specifics) {
    try {
      const response = await fetchWithTimeout(specifics.cooperationRefusedORIUrl, {
        timeout: 15000,
      })
      const data = await response.json()

      await browser.storage.local.set({ disseminators: data })
    } catch (error) {
      console.error(`Error on fetching disseminators: ${error}`)
    }
  }
}

/**
 * Fetches the ignored domains from the server.
 * @param ignoreUrl {string} API endpoint for fetching ignored domains.
 * @returns {Promise<void>} Resolves when the ignored domains are fetched.
 */
const fetchIgnore = async ({ ignoreUrl } = {}) => {
  if (!ignoreUrl) {
    console.warn('[Ignore] «ignoreUrl» is not present in config.')
    return
  }

  fetchWithTimeout(ignoreUrl, { timeout: 8000 })
    .then((response) => response.json())
    .then((domains) => {
      if (!Array.isArray(domains)) {
        console.warn('[Ignore] Response is not an array, skipping.')
        return
      }

      browser.storage.local.get({ ignoredHosts: [] })
        .then(({ ignoredHosts }) => {
          for (const domain of domains) {
            // Anything that isn't a real domain would end up permanently
            // exempted from proxying, so drop it instead of trusting the feed.
            if (!isNonEmptyString(domain) || !getDomain(domain)) {
              continue
            }

            if (!ignoredHosts.includes(domain)) {
              ignoredHosts.push(domain)
            }
          }
          browser.storage.local.set({ ignoredHosts })
            .then(() => {
              console.log('[Ignore] Globally ignored domains fetched.')
            })
        })
    })
    .catch((error) => {
      console.error(`[Ignore] Error on fetching ignored hosts: ${error}`)
    })
}

export const synchronize = async ({
  syncRegistry = true,
  syncIgnore = true,
  syncProxy = true,
} = {}) => {
  console.group('[Server] Synchronizing config...')

  const config = await fetchConfig()

  if (Object.keys(config).length > 0) {
    const { proxyUrl, ignoreUrl, registryUrl, specifics } = config

    // The three fetches hit independent endpoints and write disjoint storage
    // keys, so they run in parallel: the whole sync takes as long as the
    // slowest fetch instead of the sum of all of them. Each helper handles
    // its own errors, so Promise.all can never reject here.
    const syncTasks = []

    if (syncIgnore) {
      syncTasks.push(fetchIgnore({ ignoreUrl }))
    }

    if (syncProxy) {
      syncTasks.push(fetchProxy({ proxyUrl }))
    }

    if (syncRegistry) {
      syncTasks.push(fetchRegistry({ registryUrl, specifics }))
    }

    await Promise.all(syncTasks)
  } else {
    await browser.storage.local.set({ backendIsIntermittent: true })

    // Even when the remote config is unreachable, honor a user-supplied
    // registry mirror so the blocklist can still be refreshed.
    const { useCustomRegistry, customRegistryUrl } =
      await browser.storage.local.get({
        useCustomRegistry: false,
        customRegistryUrl: '',
      })

    if (syncRegistry && useCustomRegistry && customRegistryUrl) {
      await fetchRegistry()
    }
  }
  console.groupEnd()
}

export default {
  synchronize,
}
