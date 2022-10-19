import * as storage from 'Background/storage'

const FALLBACK_COUNTRY_CODE = ''
const FALLBACK_GEOIP_SERVICE_URL = ''

/**
 * Returns all the supported API endpoint to use for fetching the configs.
 */
const getConfigAPIEndpoints = () => {
  const endpoints = [
    {
      url: 'https://storage.googleapis.com/censortracker/config.json',
      name: 'Google Cloud Storage',
      priority: 15,
    },
    {
      url: 'https://censortracker.s3.eu-central-1.amazonaws.com/config.json',
      name: 'Amazon S3',
      priority: 10,
    },
    {
      url: 'https://d204gfm9dw21wi.cloudfront.net/',
      name: 'Amazon CloudFront',
      priority: 5,
    },
  ]

  return endpoints.sort((first, second) => second.priority - first.priority)
}

/**
 * Returns the first available API endpoint to use for fetching the config.
 * @returns {Promise<null>}
 */
export const pickConfig = async () => {
  for (const endpoint of getConfigAPIEndpoints()) {
    try {
      const response = await fetch(endpoint.url)
      const { meta, data } = await response.json()

      if (response.ok && meta.timestamp > 0) {
        const geoIPResponse = await fetch(meta.geoIPServiceURL)
        const { countryCode } = await geoIPResponse.json()

        const finalConfig = data.find((config) => {
          return config.countryCode === countryCode
        })

        console.log(finalConfig)

        return {}
      }
    } catch (error) {
      console.error(`Failed to fetch config from ${endpoint.name}`)
      storage.get({ configFailedEndpoints: [] })
        .then(({ configFailedEndpoints }) => {
          if (!configFailedEndpoints.includes(endpoint.url)) {
            configFailedEndpoints.push(endpoint)
            storage.set({ configFailedEndpoints }).then(() => {
              console.warn(`Added ${endpoint.url} to failed endpoints`)
            })
          }
        })
    }
  }
  return null
}
