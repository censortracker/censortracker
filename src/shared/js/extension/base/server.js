import browser from '../../browser-api'
import ConfigManager from './config'
import { githubConfigUrl } from './config/constants'

const getConfigAPIEndpoints = () => {
  return [
    {
      endpointName: 'GitHub',
      endpointUrl: githubConfigUrl,
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
    const response = await fetch(geoIPServiceURL)
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
  const { currentRegionCode } = await ConfigManager.get('currentRegionCode')

  for (const { endpointName, endpointUrl } of getConfigAPIEndpoints()) {
    try {
      const response = await fetch(endpointUrl)

      if (response.ok) {
        const { meta, data = {} } = await response.json()

        if (data.length === 0) {
          console.warn(`[Config] Skipping ${endpointName}...`)
          continue
        }

        let countryCode = FALLBACK_COUNTRY_CODE

        if (currentRegionCode) {
          countryCode = currentRegionCode
        } else if (meta.geoIPServiceURL) {
          countryCode = await inquireCountryCode(meta.geoIPServiceURL)
        }

        const config = data.find((cfg) => {
          return cfg.countryCode === countryCode
        })

        if (!config) {
          ConfigManager.set({ unsupportedCountry: true })
        }

        // For debugging purposes
        config.configEndpointUrl = endpointUrl
        config.configEndpointSource = endpointName

        ConfigManager.set({
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

  const { badProxies } = await ConfigManager.get('badProxies')

  console.group('[Proxy] Fetching proxy...')

  try {
    if (badProxies?.length > 0) {
      const params = new URLSearchParams()

      for (const badProxy of badProxies) {
        params.append('exclude', badProxy)
      }

      proxyUrl += `?${params.toString()}`

      console.log('Excluding bad proxies:')
      console.table(badProxies)
    }

    const response = await fetch(proxyUrl)
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
      ConfigManager.set({ proxyIsAlive: true })
      await ConfigManager.remove(
        'fallbackReason',
        'fallbackProxyInUse',
        'fallbackProxyError',
      )
    }

    ConfigManager.set({
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
 * Fetches database of blocked websites from registry.
 * @param registryUrl Registry URL.
 * @param specifics Specific attributes.
 * @returns {Promise<void>} Resolves when the database is fetched.
 */
const fetchRegistry = async ({ registryUrl, specifics = {} } = {}) => {
  if (!registryUrl) {
    console.warn('[Registry] «registryUrl» is not present in config.')
    return
  }

  console.group('[Registry] Fetching registry...')

  const apis = [{
    url: registryUrl,
    storageKey: 'domains',
  }]

  if ('cooperationRefusedORIUrl' in specifics) {
    apis.push({
      url: specifics.cooperationRefusedORIUrl,
      storageKey: 'disseminators',
    })
  }

  for (const { storageKey, url } of apis) {
    try {
      const response = await fetch(url)
      const data = await response.json()

      console.log(`Fetched: ${url}`)

      ConfigManager.set({ [storageKey]: data })
    } catch (error) {
      console.error(`Error on fetching data from: ${url}`)
    }
  }
  console.groupEnd()
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

  fetch(ignoreUrl)
    .then((response) => response.json())
    .then((domains) => {
      browser.storag.local.get({ ignoredHosts: [] })
        .then(({ ignoredHosts }) => {
          for (const domain of domains) {
            if (!ignoredHosts.includes(domain)) {
              ignoredHosts.push(domain)
            }
          }
          browser.storag.local.set({ ignoredHosts })
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
  console.groupCollapsed('[Server] Synchronizing config...')

  const configFromServer = await fetchConfig()

  if (Object.keys(configFromServer).length > 0) {
    const { proxyUrl, ignoreUrl, registryUrl, specifics } = configFromServer

    if (syncIgnore) {
      await fetchIgnore({ ignoreUrl })
    }

    if (syncProxy) {
      await fetchProxy({ proxyUrl })
    }

    if (syncRegistry) {
      await fetchRegistry({ registryUrl, specifics })
    }
  } else {
    ConfigManager.set({ backendIsIntermittent: true })
  }
  console.groupEnd()
}

export default {
  synchronize,
}
