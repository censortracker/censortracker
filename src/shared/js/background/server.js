import * as storage from './storage'

/**
 * Returns all the supported API endpoint to use for fetching the configs.
 */
const getConfigAPIEndpoints = () => {
  return [
    {
      name: 'Google Cloud Storage',
      url: 'https://storage.googleapis.com/censortracker/config.json',
    },
    {
      name: 'Amazon S3',
      url: 'https://censortracker.s3.eu-central-1.amazonaws.com/config.json',
    },
    {
      name: 'Amazon CloudFront',
      url: 'https://d204gfm9dw21wi.cloudfront.net/',
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
 * Returns the first available API endpoint to use for fetching the config.
 * @returns {Promise<null>} The first available API endpoint.
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

          console.log('[Config] Your config is:')
          console.log(localConfig)

          await storage.set({
            localConfig,
            backendIsIntermittent: false,
          })

          return localConfig
        }
      }
    } catch (error) {
      console.error(`Failed to fetch config from ${endpoint.name}`)
      await storage.set({ backendIsIntermittent: true })
    }
  }
  console.error('Failed to fetch config')
  return undefined
}

const getLocalConfig = async () => {
  const { localConfig } = await storage.get({ localConfig: {} })

  return localConfig
}

const fetchProxy = async () => {
  const localConfig = await getLocalConfig()

  console.log('Fetching available proxy server...')

  try {
    const response = await fetch(localConfig.proxyUrl)
    const { server, port, pingHost, pingPort } = await response.json()

    const proxyPingURI = `${pingHost}:${pingPort}`
    const proxyServerURI = `${server}:${port}`

    console.warn(`[Proxy] Proxy server fetched: ${proxyServerURI}!`)

    await storage.set({ proxyPingURI, proxyServerURI })
  } catch (error) {
    console.error('[Proxy] Error on fetching proxy server from the API endpoint')
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
      url: localConfig.customRegistryUrl,
      storageKey: 'customRegistryRecords',
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

export const synchronize = async () => {
  console.groupCollapsed('[Server] Synchronizing with the server...')
  await fetchConfig()
  await fetchRegistry()
  await fetchIgnore()
  await fetchProxy()
  console.groupEnd()
}

export default {
  synchronize,
}
