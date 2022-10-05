import * as storage from './storage'
import { extractHostnameFromUrl } from './utilities'

const REGISTRY_API_ENDPOINT = 'https://app.censortracker.org/api/config/'
const REGISTRY_FALLBACK_CONFIG_URL = 'https://roskomsvoboda.github.io/ctconf/registry.fallback.json'

class Registry {
  async getFallbackConfig () {
    let { registryFallbackConfig } = await storage.get('registryFallbackConfig')

    if (registryFallbackConfig === undefined) {
      const response = await fetch(REGISTRY_FALLBACK_CONFIG_URL)

      registryFallbackConfig = await response.json()

      storage.set({ registryFallbackConfig }).then(() => {
        console.warn('The fallback config fetched and cached.')
      })
      return registryFallbackConfig
    }
    return registryFallbackConfig
  }

  async getCurrentConfig () {
    const { registryConfig } = await storage.get({
      registryConfig: {},
    })

    return registryConfig
  }

  async getAPIEndpoint () {
    const {
      currentRegionCode,
      registryAPIEndpoint,
    } = await storage.get({
      currentRegionCode: '',
      registryAPIEndpoint: REGISTRY_API_ENDPOINT,
    })

    // Modifies the URL based on the current region
    // code if region is present.
    return registryAPIEndpoint + currentRegionCode
  }

  async getConfig () {
    const fallbackConfig = await this.getFallbackConfig()

    try {
      const registryAPIEndpoint = await this.getAPIEndpoint()

      console.warn(`Fetching registry config from: ${registryAPIEndpoint}`)
      const response = await fetch(`${registryAPIEndpoint}`)
      const data = await response.json()

      if (Object.keys(data).length > 0) {
        await storage.set({ registryConfig: data })
        const {
          specifics,
          registryUrl,
          countryDetails,
          customRegistryUrl,
        } = data

        const apis = []

        if (registryUrl) {
          apis.push({
            url: registryUrl,
            storageKey: 'domains',
          })
        }

        if (customRegistryUrl) {
          apis.push({
            url: customRegistryUrl,
            storageKey: 'customRegistryRecords',
          })
        }

        if (specifics) {
          apis.push({
            url: specifics.cooperationRefusedORIUrl,
            storageKey: 'disseminators',
          })
        }

        await storage.set({ backendIsIntermittent: false })
        return {
          apis,
          countryDetails,
        }
      }
      console.error('Backend is intermittent: using fallback config.')
      await storage.set({ backendIsIntermittent: true })
      return fallbackConfig
    } catch (error) {
      await storage.set({ backendIsIntermittent: true })
      console.error('Backend is intermittent: using fallback config.')
      return fallbackConfig
    }
  }

  /**
   * Save JSON data from the remote resources in local storage.
   */
  async sync () {
    console.group('Registry.sync()')
    const { apis } = await this.getConfig()

    for (const { storageKey, url } of apis) {
      try {
        const response = await fetch(url)
        const data = await response.json()

        console.warn(`${url} -> Fetched!`)

        await storage.set({ [storageKey]: data })
      } catch (error) {
        console.error(`Error on fetching data from the API endpoint: ${url}`)
      }
    }
    console.warn('Registry synced successfully.')
    console.groupEnd()
    return true
  }

  /**
   * Returns unregistered records from our custom registry.
   */
  async getCustomRegistryRecords () {
    const { customRegistryRecords } = await storage.get({
      customRegistryRecords: [],
    })

    return customRegistryRecords
  }

  /**
   * Return details of unregistered record by URL.
   */
  async getCustomRegistryRecordByURL (url) {
    const domain = extractHostnameFromUrl(url)
    const records = await this.getCustomRegistryRecords()

    for (const record of records) {
      if (record.domains.includes(domain)) {
        return record
      }
    }
    return {}
  }

  /**
   * Returns array of banned domains from the registry.
   */
  async getDomains () {
    const { domains, ignoredHosts, customProxiedDomains } =
      await storage.get({
        domains: [],
        ignoredHosts: [],
        customProxiedDomains: [],
      })

    const domainsFound = domains && domains.length > 0
    const customProxiedDomainsFound =
      customProxiedDomains && customProxiedDomains.length > 0

    if (domainsFound || customProxiedDomainsFound) {
      try {
        return [...domains, ...customProxiedDomains].filter(
          (element) => {
            return !ignoredHosts.includes(element)
          },
        )
      } catch (error) {
        console.error(error)
        return []
      }
    }
    return []
  }

  async isEmpty () {
    const domains = await this.getDomains()

    return domains.length === 0
  }

  async add (url) {
    const hostname = extractHostnameFromUrl(url)
    const { customProxiedDomains } = await storage.get({ customProxiedDomains: [] })

    if (!customProxiedDomains.includes(hostname)) {
      customProxiedDomains.push(hostname)
      console.warn(`Adding ${hostname} to the custom registry.`)
    }

    await storage.set({ customProxiedDomains })
  }

  async remove (url) {
    const hostname = extractHostnameFromUrl(url)
    const { customProxiedDomains } = await storage.get({ customProxiedDomains: [] })

    if (customProxiedDomains.includes(hostname)) {
      const index = customProxiedDomains.indexOf(hostname)

      customProxiedDomains.splice(index, 1)
      await storage.set({ customProxiedDomains })
      console.warn(`Removing ${hostname} from ignore`)
    }
  }

  /**
   * Checks if the given URL is in the registry of banned websites.
   */
  async contains (url) {
    const hostname = extractHostnameFromUrl(url)
    const {
      domains,
      ignoredHosts,
      customProxiedDomains,
    } = await storage.get({
      domains: [],
      ignoredHosts: [],
      customProxiedDomains: [],
    })

    if (ignoredHosts.includes(hostname)) {
      return false
    }

    if (domains.includes(hostname) || customProxiedDomains.includes(hostname)) {
      console.log(`Registry or custom registry match found: ${hostname}`)
      return true
    }
    return false
  }

  /**
   * Checks if the given URL is in registry of IDO (Information Dissemination Organizer).
   * This method makes sense only for some countries (Russia).
   */
  async retrieveInformationDisseminationOrganizerJSON (url) {
    const hostname = extractHostnameFromUrl(url)
    const { disseminators } = await storage.get({ disseminators: [] })

    const dataObject = disseminators.find(
      ({ url: innerUrl }) => hostname === innerUrl,
    )

    if (dataObject) {
      console.warn(`Found IDO data for ${hostname}`)
      return dataObject
    }
    return {}
  }

  async enableRegistry () {
    await storage.set({ useRegistry: true })
  }

  async disableRegistry () {
    await storage.set({ useRegistry: false })
  }

  async clearRegistry () {
    await storage.set({
      domains: [],
      customRegistryRecords: [],
    })
  }
}

export default new Registry()
