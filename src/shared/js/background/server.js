import * as storage from './storage'

const CLOUDFRONT_CONFIG_URL = 'https://d204gfm9dw21wi.cloudfront.net/'
const AWS_S3_CONFIG_URL = 'https://censortracker.s3.eu-central-1.amazonaws.com/config.json'
const GOOGLEAPIS_CONFIG_URL = 'https://storage.googleapis.com/censortracker/config.json'

const getConfigAPIEndpoints = () => {
  return [
    {
      endpointName: 'Google Cloud Storage',
      endpointUrl: GOOGLEAPIS_CONFIG_URL,
    },
    {
      endpointName: 'Amazon S3',
      endpointUrl: AWS_S3_CONFIG_URL,
    },
    {
      endpointName: 'Amazon CloudFront',
      endpointUrl: CLOUDFRONT_CONFIG_URL,
    },
  ]
}

const FALLBACK_COUNTRY_CODE = 'RU'

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

const fetchConfig = async () => {
  const { currentRegionCode } = await storage.get({
    currentRegionCode: '',
  })

  for (const { endpointName, endpointUrl } of getConfigAPIEndpoints()) {
    try {
      const response = await fetch(endpointUrl)

      if (response.ok) {
        const { meta, data = {} } = await response.json()

        if (data.length === 0) {
          console.warn(`Damaged config file. Skipping ${endpointName}...`)
          continue
        }

        console.log(`[Config] Fetched config from: ${endpointName}`)

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
          await storage.set({ unsupportedCountry: true })
        }

        // For debugging purposes
        config.configEndpointUrl = endpointUrl
        config.configEndpointSource = endpointName

        await storage.set({
          localConfig: config,
          backendIsIntermittent: false,
        })

        return config
      }
      console.warn(
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
  const { badProxies } = await storage.get({ badProxies: [] })

  try {
    // TODO: ================== REMOVE THIS  ==================
    proxyUrl = proxyUrl.replace('app.', 'dev.')

    if (badProxies.length > 0) {
      const params = new URLSearchParams()

      for (const badProxy of badProxies) {
        params.append('exclude', badProxy)
      }

      proxyUrl += `?${params.toString()}`

      console.log('[Proxy] Excluding bad proxies:')
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

    const proxyPingURI = `${pingHost}:${pingPort}`
    const proxyServerURI = `${server}:${port}`

    console.warn(`[Proxy] Proxy server fetched: ${proxyServerURI}!`)

    await storage.set({
      proxyPingURI,
      proxyServerURI,
      fallbackReason,
      currentProxyServer: server,
    })
  } catch (error) {
    console.error(
      `[Proxy] Error on fetching proxy server: ${error}`,
    )
  }
}

const fetchRegistry = async ({ registryUrl, specifics = {} } = {}) => {
  console.groupCollapsed('[Registry] Fetching registry data...')

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

      console.warn(`[Registry] Fetched: ${url}`)

      await storage.set({ [storageKey]: data })
    } catch (error) {
      console.error(`[Registry] Error on fetching data from: ${url}`)
    }
  }
  console.groupEnd()
}

const fetchIgnore = async ({ ignoreUrl } = {}) => {
  fetch(ignoreUrl)
    .then((response) => response.json())
    .then((domains) => {
      storage.get({ ignoredHosts: [] })
        .then(({ ignoredHosts }) => {
          for (const domain of domains) {
            if (!ignoredHosts.includes(domain)) {
              ignoredHosts.push(domain)
            }
          }
          storage.set({ ignoredHosts })
            .then(() => {
              console.log('[Ignore] Globally ignored domains fetched.')
            })
        })
    })
    .catch((error) => {
      console.error(`[Ignore] Error on fetching ignored hosts: ${error}`)
    })
}

export const synchronize = async () => {
  console.groupCollapsed('[Server] Synchronizing with the server...')

  const config = await fetchConfig()

  if (Object.keys(config).length > 0) {
    const { proxyUrl, ignoreUrl, registryUrl, specifics } = config

    console.log(config)

    if (ignoreUrl) {
      await fetchIgnore({ ignoreUrl })
    } else {
      console.warn('[Ignore] «ignoreUrl» is not present in config.')
    }

    if (proxyUrl) {
      await fetchProxy({ proxyUrl })
    } else {
      console.error('[Proxy] «proxyUrl» is not present in config.')
    }

    if (registryUrl) {
      await fetchRegistry({ registryUrl, specifics })
    } else {
      console.error('[Registry] «registryUrl» is not present in config.')
    }
  } else {
    await storage.set({ backendIsIntermittent: true })
  }
  console.groupEnd()
}

export default {
  synchronize,
}
