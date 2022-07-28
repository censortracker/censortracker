import * as storage from './storage'
import * as utilities from './utilities'

const REGISTRY_API_ENDPOINT = 'https://app.censortracker.org/api/config/'

class Registry {
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
    try {
      const registryAPIEndpoint = await this.getAPIEndpoint()

      console.warn(`Fetching registry config from: ${registryAPIEndpoint}`)
      const response = await fetch(`${registryAPIEndpoint}`)

      if (response.ok) {
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
          return {
            apis,
            countryDetails,
          }
        }
      }
      console.warn('Censor Tracker does not support your country.')
      return {}
    } catch (error) {
      console.error(error)
      return {}
    }
  }

  /**
   * Save JSON data from the remote resources in local storage.
   */
  async sync () {
    console.group('Registry.sync()')
    const { apis } = await this.getConfig()

    if (apis.length === 0) {
      console.error('Sync error: there are no API endpoints for your country.')
      return false
    }

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
    const domain = utilities.extractHostnameFromUrl(url)
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

  /**
   * Checks if the given URL is in the registry of banned websites.
   */
  async contains (url) {
    const hostname = utilities.extractHostnameFromUrl(url)
    const { domains, ignoredHosts } = await storage.get({
      domains: [],
      ignoredHosts: [],
    })

    if (domains.includes(hostname) && !ignoredHosts.includes(hostname)) {
      console.log(`Registry match found: ${hostname}`)
      return true
    }
    return false
  }

  /**
   * Checks if the given URL is in registry of IDO (Information Dissemination Organizer).
   * This method makes sense only for some countries (Russia).
   */
  async retrieveInformationDisseminationOrganizerJSON (url) {
    const hostname = utilities.extractHostnameFromUrl(url)
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
