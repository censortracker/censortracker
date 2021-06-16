import storage from './storage'
import { extractHostnameFromUrl } from './utilities'

const CENSORTRACKER_CONFIG_API_URL = 'https://app.censortracker.org/api/config/'

class Registry {
  constructor () {
    this.cachedConfig = undefined

    setInterval(async () => {
      await this.sendReport()
    }, 60 * 60 * 3000)

    setInterval(async () => {
      await this.cleanLocalRegistry()
    }, 60 * 60 * 1000)

    setInterval(async () => {
      const { domains } = await storage.get({ domains: [] })

      if (domains.length === 0) {
        await this.sync()
      }
    }, 60 * 60 * 400)

    setInterval(async () => {
      this.cachedConfig = undefined
      console.log('Registry: cached config removed!')
    }, 60 * 60 * 500)
  }

  /**
   * Fetch config for the user's country from the server (GeoIP).
   * If the config for the country is not present then local registry
   * of restricted websites will be empty.
   * @returns {Promise<Object>}
   */
  getConfig = async () => {
    if (this.cachedConfig !== undefined) {
      return this.cachedConfig
    }

    try {
      const response = await fetch(CENSORTRACKER_CONFIG_API_URL)

      if (response.status === 200) {
        const {
          registryUrl,
          countryDetails,
          reportEndpoint,
          customRegistryUrl,
          specifics,
        } = await response.json()

        const apis = [
          {
            url: registryUrl,
            storageKey: 'domains',
          },
          {
            url: customRegistryUrl,
            storageKey: 'unregisteredRecords',
          },
        ]

        if (specifics) {
          apis.push({
            url: specifics.cooperationRefusedORIUrl,
            storageKey: 'distributors',

          })
        }

        this.cachedConfig = {
          apis,
          reportEndpoint,
          countryDetails,
        }

        return this.cachedConfig
      }
      console.warn('CensorTracker do not support your country.')
    } catch (error) {
      console.error(error)
    }
    return {}
  }

  /**
   * Save JSON data from the remote resource in local storage.
   * @returns {Promise<boolean>} Returns true when succeed.
   */
  sync = async () => {
    const { apis } = await this.getConfig()

    for (const { storageKey, url } of apis) {
      try {
        const response = await fetch(url)
        const jsonData = await response.json()

        await storage.set({ [storageKey]: jsonData })
        console.log(await storage.get({ [storageKey]: null }))
      } catch (error) {
        console.error(`Error on fetching data from the API endpoint: ${url}`)
      }
    }
    return true
  }

  /**
   * Returns unregistered records from our custom registry.
   */
  getUnregisteredRecords = async () => {
    const { unregisteredRecords } = await storage.get({ unregisteredRecords: [] })

    return unregisteredRecords
  }

  /**
   * Return details of unregistered record by URL.
   * @param url URL.
   */
  getUnregisteredRecordByURL = async (url) => {
    const domain = extractHostnameFromUrl(url)
    const records = await this.getUnregisteredRecords()

    for (const record of records) {
      if (record.domains.includes(domain)) {
        return record
      }
    }
    return {}
  }

  /**
   * Returns array of domains from the RKN's registry.
   */
  getDomains = async () => {
    const { domains, blockedDomains } = await storage.get({ domains: [], blockedDomains: [] })

    const domainsFound = domains && domains.length > 0
    const blockedDomainsFound = blockedDomains && blockedDomains.length > 0

    if (domainsFound || blockedDomainsFound) {
      try {
        return [...domains, ...blockedDomains]
      } catch (error) {
        console.log(error)
      }
    }
    return []
  }

  /**
   * Checks if URL is in the registry of restricted websites.
   * @param url URL.
   * @returns {Promise<{boolean}>}
   */
  contains = async (url) => {
    const hostname = extractHostnameFromUrl(url)
    const { domains, blockedDomains } =
      await storage.get({
        domains: [],
        blockedDomains: [],
      })

    const domainsArray = domains.concat(blockedDomains)

    if (domainsArray.includes(hostname)) {
      console.log(`Registry match found: ${hostname}`)
      return true
    }
    return false
  }

  /**
   * Checks if URL in registry of "ОРИ".
   * @param url URL.
   * @returns {Promise<{}|*>}
   */
  distributorsContains = async (url) => {
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
   * Sends a report about sites that potentially can be restricted through by DPI-filters.
   */
  sendReport = async () => {
    const { alreadyReported, blockedDomains } =
      await storage.get({
        alreadyReported: [],
        blockedDomains: [],
      })

    const { reportEndpoint } = await this.getConfig()

    for (const hostname of blockedDomains) {
      if (!alreadyReported.includes(hostname)) {
        const timestamp = new Date().getTime()

        await fetch(reportEndpoint, {
          method: 'POST',
          headers: {
            'Censortracker-D': timestamp,
            'Censortracker-V': '^3.0.0',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ hostname }),
        })
        alreadyReported.push(hostname)
        await storage.set({ alreadyReported })
        console.warn(`Reported new lock: ${hostname}`)
      }
    }
  }

  /**
   * Clean local registry by schedule.
   * @returns {Promise<void>}
   */
  cleanLocalRegistry = async () => {
    const day = new Date().getDate()
    const cleaningDays = [5, 15, 20, 25, 30]

    if (cleaningDays.includes(day)) {
      await storage.set({ blockedDomains: [] })
      console.warn('Outdated domains has been removed.')
    }
  }

  /**
   * Adds passed hostname to the local storage of restricted domains.
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
