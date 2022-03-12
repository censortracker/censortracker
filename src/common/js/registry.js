import storage from './storage'
import { extractHostnameFromUrl } from './utilities'

const CENSORTRACKER_CONFIG_API_URL = 'https://app.censortracker.org/api/config/'
const SYNC_REGISTRY_TIMEOUT = (60 * 20) * 1000 // Every 30 minutes

class Registry {
  constructor () {
    setInterval(async () => {
      await this.sendReport()
      await this.clear()
    }, 60 * 60 * 1000)

    setInterval(async () => {
      const { domains } = await storage.get({ domains: [] })

      if (domains.length === 0) {
        await this.sync()
      }
    }, SYNC_REGISTRY_TIMEOUT)
  }

  /**
   * Fetch config for the user's country from the server (GeoIP).
   * If the config for the country is not present then local registry
   * of banned websites will be empty.
   * @returns {Promise<Object>}
   */
  getConfig = async () => {
    try {
      const response = await fetch(CENSORTRACKER_CONFIG_API_URL)

      if (response.status === 200) {
        const apis = []
        const {
          registryUrl,
          countryDetails,
          reportEndpoint,
          customRegistryUrl,
          specifics,
        } = await response.json()

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

        await storage.set({ countryDetails })

        return {
          apis,
          reportEndpoint,
          countryDetails,
        }
      }
      console.warn('CensorTracker do not support your country.')
    } catch (error) {
      console.error(error)
      return {}
    }
    return {}
  }

  isConfiguredForCountry = async ({ code }) => {
    const { countryDetails: { isoA2Code } } = await this.getConfig()

    return isoA2Code.toUpperCase() === code.toUpperCase()
  }

  /**
   * Save JSON data from the remote resource in local storage.
   * @returns {Promise<boolean>} Returns true when succeed.
   */
  sync = async () => {
    const { apis, countryDetails: { name: countryName } } = await this.getConfig()

    if (apis.length === 0) {
      console.error(`Sync error: API endpoints are not provided for: ${countryName}.`)
      return false
    }

    for (const { storageKey, url } of apis) {
      try {
        const response = await fetch(url)
        const jsonData = await response.json()

        await storage.set({ [storageKey]: jsonData })
      } catch (error) {
        console.error(`Error on fetching data from the API endpoint: ${url}`)
      }
    }
    console.warn('Synced!')
    return true
  }

  /**
   * Returns unregistered records from our custom registry.
   */
  getCustomRegistryRecords = async () => {
    const { customRegistryRecords } = await storage.get({ customRegistryRecords: [] })

    return customRegistryRecords
  }

  /**
   * Return details of unregistered record by URL.
   * @param url URL.
   */
  getCustomRegistryRecordByURL = async (url) => {
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
  getDomains = async () => {
    const { domains, blockedDomains, ignoredHosts, customProxiedDomains } = await storage.get({
      domains: [],
      blockedDomains: [],
      ignoredHosts: [],
      customProxiedDomains: [],
    })

    const domainsFound = domains && domains.length > 0
    const blockedDomainsFound = blockedDomains && blockedDomains.length > 0
    const customProxiedDomainsFound = customProxiedDomains && customProxiedDomains.length > 0

    if (domainsFound || blockedDomainsFound || customProxiedDomainsFound) {
      try {
        return [...domains, ...blockedDomains, ...customProxiedDomains].filter((element) => {
          return !ignoredHosts.includes(element)
        })
      } catch (error) {
        console.log(error)
      }
    }
    return []
  }

  /**
   * Checks if the given URL is in the registry of banned websites.
   * @param url URL.
   * @returns {Promise<{boolean}>}
   */
  contains = async (url) => {
    const hostname = extractHostnameFromUrl(url)
    const { domains, ignoredHosts, blockedDomains } =
      await storage.get({
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
  }

  /**
   * Checks if the given URL is in registry of ISO (Information Dissemination Organizer).
   * This method makes sense only for some countries (Russia).
   * @param url URL.
   * @returns {Promise<{}|*>}
   */
  retrieveInformationDisseminationOrganizerJSON = async (url) => {
    const hostname = extractHostnameFromUrl(url)
    const { distributors } =
      await storage.get({ distributors: [] })

    const dataObject = distributors.find(({ url: innerUrl }) => (hostname === innerUrl))

    if (dataObject) {
      return dataObject
    }
    return {}
  }

  /**
   * Sends a report about sites that potentially can be banned by DPI-filters.
   */
  sendReport = async () => {
    const { alreadyReported, blockedDomains, useDPIDetection } =
      await storage.get({
        alreadyReported: [],
        blockedDomains: [],
        useDPIDetection: false,
      })

    if (useDPIDetection) {
      const userAgent = navigator.userAgent
      const { reportEndpoint } = await this.getConfig()

      for (const domain of blockedDomains) {
        if (!alreadyReported.includes(domain)) {
          await fetch(reportEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              domain,
              userAgent,
            }),
          })
          alreadyReported.push(domain)
          await storage.set({ alreadyReported })
          console.warn(`Reported new domain: ${domain}`)
        }
      }
    }
  }

  /**
   * Clean local registry by schedule.
   * @returns {Promise<void>}
   */
  clear = async () => {
    const day = new Date().getDate()

    if (day % 2 === 0) {
      await storage.set({ blockedDomains: [] })
      console.warn('Outdated domains has been removed.')
    }
  }

  /**
   * Adds passed hostname to the local storage of banned domains.
   * @param url Hostname.
   */
  add = async (url) => {
    const hostname = extractHostnameFromUrl(url)
    const { blockedDomains } = await storage.get({ blockedDomains: [] })

    if (!blockedDomains.includes(hostname)) {
      blockedDomains.push(hostname)
      console.warn(`Domain ${hostname} added to local registry`)
    }

    await storage.set({ blockedDomains })
  }
}

export default new Registry()
