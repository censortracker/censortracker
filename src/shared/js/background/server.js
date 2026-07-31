import axios from 'axios'

import browser from './browser-api'

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
  console.log(`[GeoIP] Fetching country code from: ${geoIPServiceURL}`)
  try {
    const response = await axios.get(geoIPServiceURL, {
      timeout: 5000,
      responseType: 'json',
    })
    const { countryCode } = response.data

    console.log(`[GeoIP] Successfully retrieved country code: ${countryCode}`)

    return countryCode
  } catch (error) {
    console.error(`[GeoIP] Failed to fetch country code from ${geoIPServiceURL}:`, error.message)
    console.warn(`[GeoIP] Falling back to default country code: ${FALLBACK_COUNTRY_CODE}`)
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
    console.log(`[Config] Attempting to fetch from ${endpointName}: ${endpointUrl}`)
    try {
      const response = await axios.get(endpointUrl, {
        timeout: 5000,
        responseType: 'json',
        validateStatus: () => true,
      })

      if (response.status >= 200 && response.status < 300) {
        const { meta, data = {} } = response.data

        if (data.length === 0) {
          console.warn(`[Config] ${endpointName} returned empty data, trying next endpoint...`)
          continue
        }

        let countryCode = FALLBACK_COUNTRY_CODE

        if (currentRegionCode) {
          countryCode = currentRegionCode
          console.log(`[Config] Using stored region code: ${countryCode}`)
        } else if (meta.geoIPServiceURL) {
          countryCode = await inquireCountryCode(meta.geoIPServiceURL)
        } else {
          console.log(`[Config] No GeoIP service available, using fallback: ${FALLBACK_COUNTRY_CODE}`)
        }

        const config = data.find((cfg) => {
          return cfg.countryCode === countryCode
        })

        if (!config) {
          console.warn(`[Config] No configuration found for country code: ${countryCode}`)
          await browser.storage.local.set({ unsupportedCountry: true })
        } else {
          console.log(`[Config] Found configuration for country: ${countryCode}`)
        }

        // For debugging purposes
        config.configEndpointUrl = endpointUrl
        config.configEndpointSource = endpointName

        await browser.storage.local.set({
          localConfig: config,
          backendIsIntermittent: false,
        })

        console.log(`[Config] Successfully loaded config from ${endpointName}`)
        return config
      }
      console.error(
        `[Config] HTTP ${response.status} error from ${endpointName}, trying next endpoint...`,
      )
    } catch (error) {
      console.error(`[Config] Request failed for ${endpointName}:`, error.message)
    }
  }

  console.error('[Config] All config endpoints failed, returning empty config')
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

  console.group('[Proxy] Fetching proxy configuration...')
  console.log(`[Proxy] Requesting from: ${proxyUrl}`)

  try {
    if (badProxies.length > 0) {
      const params = new URLSearchParams()

      for (const badProxy of badProxies) {
        params.append('exclude', badProxy)
      }

      proxyUrl += `?${params.toString()}`

      console.log(`[Proxy] Excluding ${badProxies.length} bad proxy/proxies:`)
      console.table(badProxies)
    } else {
      console.log('[Proxy] No bad proxies to exclude')
    }

    const response = await axios.get(proxyUrl, {
      timeout: 5000,
      responseType: 'json',
      validateStatus: () => true,
    })

    console.log(`[Proxy] Response status: ${response.status}`)

    const {
      server,
      port,
      pingHost,
      pingPort,
      fallbackReason,
    } = response.data

    const fallbackProxyInUse = !!fallbackReason

    const proxyPingURI = `${pingHost}:${pingPort}`
    const proxyServerURI = `${server}:${port}`

    if (fallbackProxyInUse) {
      console.warn(`[Proxy] Using fallback proxy: ${proxyServerURI}`)
      console.warn(`[Proxy] Fallback reason: ${fallbackReason}`)
    } else {
      console.log(`[Proxy] Successfully fetched proxy: ${proxyServerURI}`)
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

    console.log(`[Proxy] Ping URI: ${proxyPingURI}`)
    console.log('[Proxy] Proxy configuration saved successfully')
  } catch (error) {
    console.error(`[Proxy] Failed to fetch proxy from ${proxyUrl}:`, error.message)
    console.error('[Proxy] Error details:', error)
  }
  console.groupEnd()
}
/**
 * Fetches database of blocked websites from registry.
 * @param registryUrl Registry URL.
 * @param specifics Specific attributes.
 * @returns {Promise<void>} Resolves when the database is fetched.
 */
const fetchRegistry = async ({ registryUrl, specifics = {} } = {}) => {
  if (!registryUrl) {
    console.warn('[Registry] «registryUrl» is not present in config, skipping registry sync')
    return
  }

  console.log('[Registry] Starting registry synchronization...')

  const apis = [{
    url: registryUrl,
    storageKey: 'domains',
  }]

  if ('cooperationRefusedORIUrl' in specifics) {
    apis.push({
      url: specifics.cooperationRefusedORIUrl,
      storageKey: 'disseminators',
    })
    console.log('[Registry] Will also fetch cooperation refused ORI list')
  }

  for (const { storageKey, url } of apis) {
    try {
      console.log(`[Registry] Fetching ${storageKey} from: ${url}`)
      const response = await axios.get(url, {
        timeout: 10_000,
        responseType: 'json',
        validateStatus: () => true,
      })

      if (response.status >= 200 && response.status < 300) {
        const data = response.data
        const itemCount = Array.isArray(data)
          ? data.length : Object.keys(data).length

        await browser.storage.local.set({ [storageKey]: data })
        console.log(`[Registry] Successfully saved ${itemCount} items to «${storageKey}»`)
      } else {
        console.error(`[Registry] HTTP ${response.status} error for ${storageKey} from: ${url}`)
      }
    } catch (error) {
      console.error(`[Registry] Failed to fetch ${storageKey} from ${url}:`, error.message)
    }
  }
  console.log('[Registry] Registry synchronization completed')
}

/**
 * Fetches the ignored domains from the server.
 * @param ignoreUrl {string} API endpoint for fetching ignored domains.
 * @returns {Promise<void>} Resolves when the ignored domains are fetched.
 */
const fetchIgnore = async ({ ignoreUrl } = {}) => {
  if (!ignoreUrl) {
    console.warn('[Ignore] «ignoreUrl» is not present in config, skipping ignore list sync')
    return
  }

  console.log(`[Ignore] Fetching globally ignored domains from: ${ignoreUrl}`)

  axios.get(ignoreUrl, {
    timeout: 3000,
    responseType: 'json',
    validateStatus: () => true,
  })
    .then((response) => {
      console.log(`[Ignore] Response status: ${response.status}`)
      return response.data
    })
    .then((domains) => {
      console.log(`[Ignore] Received ${domains.length} domains from server`)
      browser.storage.local.get({ ignoredHosts: [] })
        .then(({ ignoredHosts }) => {
          const initialCount = ignoredHosts.length
          let addedCount = 0

          for (const domain of domains) {
            if (!ignoredHosts.includes(domain)) {
              ignoredHosts.push(domain)
              addedCount++
            }
          }

          browser.storage.local.set({ ignoredHosts })
            .then(() => {
              console.log(`[Ignore] Successfully updated ignore list: ${addedCount} new, ${initialCount} existing, ${ignoredHosts.length} total`)
            })
        })
    })
    .catch((error) => {
      console.error(`[Ignore] Failed to fetch ignored hosts from ${ignoreUrl}:`, error.message)
    })
}

export const synchronize = async ({
  syncRegistry = true,
  syncIgnore = true,
  syncProxy = true,
} = {}) => {
  console.group('[Server] Starting synchronization...')

  const syncOptions = []

  if (syncRegistry) {
    syncOptions.push('SYNC_REGISTRY')
  }
  if (syncIgnore) {
    syncOptions.push('SYNC_IGNORE')
  }
  if (syncProxy) {
    syncOptions.push('SYNC_PROXY')
  }

  console.log(`[Server] Sync options: ${syncOptions.join(', ')}`)

  const config = await fetchConfig()

  if (Object.keys(config).length > 0) {
    const { proxyUrl, ignoreUrl, registryUrl, specifics } = config

    console.log('[Server] Configuration loaded successfully, proceeding with sync...')

    if (syncIgnore) {
      await fetchIgnore({ ignoreUrl })
    }

    if (syncProxy) {
      await fetchProxy({ proxyUrl })
    }

    if (syncRegistry) {
      await fetchRegistry({ registryUrl, specifics })
    }

    console.log('[Server] Synchronization completed successfully')
  } else {
    console.error('[Server] Failed to fetch configuration from all endpoints')
    await browser.storage.local.set({ backendIsIntermittent: true })
    console.warn('[Server] Backend marked as intermittent')
  }
  console.groupEnd()
}

export default {
  synchronize,
}
