import * as storage from './storage'

const CLOUDFRONT_CONFIG_URL = 'https://d204gfm9dw21wi.cloudfront.net/'
const AWS_S3_CONFIG_URL = 'https://censortracker.s3.eu-central-1.amazonaws.com/config.json'
const GOOGLEAPIS_CONFIG_URL = 'https://storage.googleapis.com/censortracker/config.json'

/**
 * Returns all the supported API endpoint to use.
 */
const getConfigAPIEndpoints = () => {
  return [
    {
      name: 'Google Cloud Storage',
      url: GOOGLEAPIS_CONFIG_URL,
    },
    {
      name: 'Amazon S3',
      url: AWS_S3_CONFIG_URL,
    },
    {
      name: 'Amazon CloudFront',
      url: CLOUDFRONT_CONFIG_URL,
    },
  ]
}

const FALLBACK_COUNTRY_CODE = 'RU'

/**
 * Returns the country code of the user using GeoIP API.
 * @param geoIPServiceURL The URL of the GeoIP service.
 * @returns {Promise<string|*>} The country code of the user.
 */
const inquireCountryCode = async (geoIPServiceURL) => {
  try {
    const response = await fetch(geoIPServiceURL)
    const { countryCode } = await response.json()

    console.log(`[GeoIP] Your country is: ${countryCode}.`)

    return countryCode
  } catch (error) {
    console.error('[GeoIP] Error on fetching country code. Using fallback.')
    return FALLBACK_COUNTRY_CODE
  }
}

/**
 * Fetches the config from the API endpoint.
 * @returns {Promise<>} Nothing.
 */
const fetchConfig = async () => {
  const { currentRegionCode } = await storage.get({
    currentRegionCode: '',
  })

  for (const endpoint of getConfigAPIEndpoints()) {
    try {
      const response = await fetch(endpoint.url)

      if (response.ok) {
        const { meta, data } = await response.json()

        if (data && data.length === 0) {
          console.warn('Damaged config file. Skipping...')
          continue
        }

        console.log(`[Config] Fetched config from: ${endpoint.name}`)

        if (meta.timestamp > 0) {
          let countryCode = FALLBACK_COUNTRY_CODE

          if (currentRegionCode) {
            countryCode = currentRegionCode
          } else if (meta.geoIPServiceURL) {
            countryCode = await inquireCountryCode(meta.geoIPServiceURL)
          }

          const localConfig = data.find((cfg) => {
            return cfg.countryCode === countryCode
          })

          // For debugging purposes
          localConfig.configEndpointUrl = endpoint.url
          localConfig.configEndpointSource = endpoint.name

          console.log(localConfig)

          await storage.set({
            localConfig,
            backendIsIntermittent: false,
          })

          return localConfig
        }
      } else {
        console.warn(
          `[Config] Error on fetching config from: ${endpoint.name}`,
        )
      }
    } catch (error) {
      console.error(`Failed to fetch config from ${endpoint.name}: ${error}`)
    }
  }
  await storage.set({ backendIsIntermittent: true })
  return undefined
}

const getLocalConfig = async () => {
  const { localConfig } = await storage.get({ localConfig: {} })

  return localConfig
}

/**
 * Fetches the config and registry data.
 * @param excludeServer The server to exclude from the fetch.
 * @returns {Promise<void>} Nothing.
 */
const fetchProxy = async ({ excludeServer } = {}) => {
  let { proxyUrl } = await getLocalConfig()
  const { badProxies } = await storage.get({ badProxies: [] })

  if (proxyUrl) {
    console.log('[Proxy] Fetching available proxy server...')

    if (excludeServer) {
      const params = new URLSearchParams({
        exclude: excludeServer,
      })

      proxyUrl += params.toString()

      if (!badProxies.includes(excludeServer)) {
        badProxies.push(excludeServer)
        await storage.set({ badProxies })
      }
      console.warn(`[Proxy] Excluding bad proxies: ${JSON.stringify(badProxies)}`)
    }

    try {
      const response = await fetch(proxyUrl)
      const { server, port, pingHost, pingPort } = await response.json()

      if (badProxies.includes(server)) {
        await fetchProxy({ exclude: server })
      }

      const proxyPingURI = `${pingHost}:${pingPort}`
      const proxyServerURI = `${server}:${port}`

      console.warn(`[Proxy] Proxy server fetched: ${proxyServerURI}!`)

      await storage.set({
        proxyPingURI,
        proxyServerURI,
        currentProxyServer: server,
      })
    } catch (error) {
      console.error(
        '[Proxy] Error on fetching proxy server from the API endpoint',
      )
    }
  } else {
    console.error('[Proxy] No proxy API endpoint is found in local config.')
    await fetchConfig()
  }
}

const fetchRegistry = async () => {
  const localConfig = await getLocalConfig()

  console.log('[Registry] Fetching registry data...')

  const apis = [
    {
      url: localConfig.registryUrl,
      storageKey: 'domains',
    },
    {
      url: localConfig.specifics.cooperationRefusedORIUrl,
      storageKey: 'disseminators',
    },
  ]

  for (const { storageKey, url } of apis) {
    try {
      const response = await fetch(url)
      const data = await response.json()

      console.warn(`[Registry] Fetched: ${url}`)

      await storage.set({ [storageKey]: data })
    } catch (error) {
      console.error(`[Registry] Error on fetching data from: ${url}`)
    }
  }
}

const fetchIgnore = async () => {
  const localConfig = await getLocalConfig()

  console.log('[Ignore] Fetching ignored hosts...')

  try {
    const { ignoredHosts } = await storage.get({ ignoredHosts: [] })
    const response = await fetch(localConfig.ignoreUrl)
    const domains = await response.json()

    for (const domain of domains) {
      if (!ignoredHosts.includes(domain)) {
        ignoredHosts.push(domain)
      }
    }
    await storage.set({ ignoredHosts })
    console.log('[Ignore] Globally ignored domains fetched.')
  } catch (error) {
    console.error(`[Ignore] Error on fetching ignored hosts: ${error}`)
  }
}

export const synchronize = async (params = {}) => {
  console.groupCollapsed('[Server] Synchronizing with the server...')
  await fetchConfig()
  await fetchRegistry()
  await fetchIgnore()
  await fetchProxy(params)
  console.groupEnd()
}

export default {
  synchronize,
  fetchConfig,
  fetchRegistry,
  fetchIgnore,
  fetchProxy,
  getLocalConfig,
}
