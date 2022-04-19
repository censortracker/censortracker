import * as storage from './storage'
import * as utilities from './utilities'

const CONFIG_API_URL = 'https://app.censortracker.org/api/config/'
const SYNC_TIMEOUT = 60 * 30 * 1000 // Every 30 minutes
const CONFIG_EXPIRATION_TIME = 60 * 60 * 3000 // 3 Hours

class Registry {
  constructor () {
    setInterval(async () => {
      await this.sync()
      await this.clear()
    }, SYNC_TIMEOUT)
  }

  async configExpired () {
    const { registryConfigTimestamp } = await storage.get({
      registryConfigTimestamp: utilities.timestamp(),
    })

    return (utilities.timestamp() - registryConfigTimestamp) >= CONFIG_EXPIRATION_TIME
  }

  async getConfig () {
    const configExpired = await this.configExpired()
    const { registryConfig } = await storage.get(['registryConfig'])

    if (registryConfig && !configExpired) {
      console.warn('Using cached registry config...')
      return registryConfig
    }

    console.warn(`Fetching registry config from: ${CONFIG_API_URL}`)

    try {
      const response = await fetch(CONFIG_API_URL)
      const data = await response.json()

      if (Object.keys(data).length > 0) {
        const {
          specifics,
          registryUrl,
          countryDetails,
          reportEndpoint,
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
          if (countryDetails.isoA2Code === 'RU') {
            apis.push({
              url: specifics.cooperationRefusedORIUrl,
              storageKey: 'distributors',
            })
          }
        }

        const config = {
          apis,
          reportEndpoint,
          countryDetails,
        }

        await storage.set({ countryDetails }) // FIXME
        await storage.set({
          registryConfig: config,
          registryConfigTimestamp: utilities.timestamp(),
        })

        console.warn('Registry config cached successfully.')

        return config
      }
      console.warn('CensorTracker do not support your country.')
      return {}
    } catch (error) {
      console.error(error)
      return {}
    }
  };

  /**
   * Save JSON data from the remote resources in local storage.
   */
  async sync () {
    const { apis } = await this.getConfig()

    if (apis.length > 0) {
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
    } else {
      console.error(
        'Sync error: API endpoints are not provided for your country.',
      )
    }
    return true
  };

  /**
   * Returns unregistered records from our custom registry.
   */
  async getCustomRegistryRecords () {
    const { customRegistryRecords } = await storage.get({
      customRegistryRecords: [],
    })

    return customRegistryRecords
  };

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
  };

  /**
   * Returns array of banned domains from the registry.
   */
  async getDomains () {
    const { domains, blockedDomains, ignoredHosts, customProxiedDomains } =
      await storage.get({
        domains: [],
        blockedDomains: [],
        ignoredHosts: [],
        customProxiedDomains: [],
      })

    const domainsFound = domains && domains.length > 0
    const blockedDomainsFound = blockedDomains && blockedDomains.length > 0
    const customProxiedDomainsFound =
      customProxiedDomains && customProxiedDomains.length > 0

    if (domainsFound || blockedDomainsFound || customProxiedDomainsFound) {
      try {
        return [...domains, ...blockedDomains, ...customProxiedDomains].filter(
          (element) => {
            return !ignoredHosts.includes(element)
          },
        )
      } catch (error) {
        console.log(error)
      }
    }
    return []
  };

  /**
   * Checks if the given URL is in the registry of banned websites.
   */
  async contains (url) {
    const hostname = utilities.extractHostnameFromUrl(url)
    const { domains, ignoredHosts, blockedDomains } = await storage.get({
      domains: [],
      ignoredHosts: [],
      blockedDomains: [],
    })

    const domainsArray = domains.concat(blockedDomains)

    if (domainsArray.includes(hostname) && !ignoredHosts.includes(hostname)) {
      console.log(`Registry match found: ${hostname}`)
      return true
    }
    return false
  };

  /**
   * Checks if the given URL is in registry of ISO (Information Dissemination Organizer).
   * This method makes sense only for some countries (Russia).
   */
  async retrieveInformationDisseminationOrganizerJSON (url) {
    const hostname = utilities.extractHostnameFromUrl(url)
    const { distributors } = await storage.get({ distributors: [] })

    const dataObject = distributors.find(
      ({ url: innerUrl }) => hostname === innerUrl,
    )

    if (dataObject) {
      return dataObject
    }
    return {}
  };

  /**
   * Clean local registry by schedule.
   */
  async clear () {
    const day = new Date().getDate()

    if (day % 2 === 0) {
      await storage.set({ blockedDomains: [] })
      console.warn('Outdated domains has been removed.')
    }
  };

  /**
   * Adds passed hostname to the local storage of banned domains.
   */
  async add (url) {
    const hostname = utilities.extractHostnameFromUrl(url)
    const { blockedDomains } = await storage.get({ blockedDomains: [] })

    if (!blockedDomains.includes(hostname)) {
      blockedDomains.push(hostname)
      console.warn(`Domain ${hostname} added to local registry`)
    }

    await storage.set({ blockedDomains })
  };
}

export default new Registry()