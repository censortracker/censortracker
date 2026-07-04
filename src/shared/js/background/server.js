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
 * Fetches config from the server.
 * @returns {Promise<{}|*>} Resolves with the config.
 */
const fetchConfig = async () => {
  const { currentRegionCode } = await browser.storage.local.get({
    currentRegionCode: '',
  })

  for (const { endpointName, endpointUrl } of getConfigAPIEndpoints()) {
    try {
      const response = await fetchWithTimeout(endpointUrl, { timeout: 8000 })

      if (response.ok) {
        const { meta = {}, data = [] } = await response.json()

        if (!Array.isArray(data) || data.length === 0) {
          console.warn(`[Config] Skipping ${endpointName}...`)
          continue
        }

        let countryCode = FALLBACK_COUNTRY_CODE

        if (currentRegionCode) {
          countryCode = currentRegionCode
        } else if (meta.geoIPServiceURL) {
          countryCode = await inquireCountryCode(meta.geoIPServiceURL)
        }

        let config = data.find((cfg) => {
          return cfg.countryCode === countryCode
        })

        if (!config) {
          // The selected country isn't supported by this config: fall back to
          // the first available entry instead of crashing on `undefined`.
          await browser.storage.local.set({ unsupportedCountry: true })
          config = data[0]
        } else {
          await browser.storage.local.set({ unsupportedCountry: false })
        }

        if (!config) {
          continue
        }

        // For debugging purposes
        config.configEndpointUrl = endpointUrl
        config.configEndpointSource = endpointName

        await browser.storage.local.set({
          localConfig: config,
          backendIsIntermittent: false,
        })

        return config
      }
      console.error(
        `[Config] Error on fetching config from: ${endpointName}`,
      )
    } catch (error) {
      console.error(`[Config] Failed to fetch config from ${endpointName}: ${error}`)
    }
  }
  return {}
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
    const {
      server,
      port,
      pingHost,
      pingPort,
      fallbackReason,
    } = await response.json()

    const fallbackProxyInUse = !!fallbackReason

    console.warn(`Status: ${response.status}`)

    const proxyPingURI = `${pingHost}:${pingPort}`
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

  console.warn(`[Registry] Fetching registry from ${effectiveRegistryUrl}...`)

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
      browser.storage.local.get({ ignoredHosts: [] })
        .then(({ ignoredHosts }) => {
          for (const domain of domains) {
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
