import storage from './storage'
import { extractHostnameFromUrl } from './utilities'

const REGISTRY_BASE_URL = 'https://reestr.rublacklist.net'
const REGISTRY_LOGGING_API_URL = 'https://ct.rublacklist.net/api/case/'
const REGISTRY_DOMAINS_API_URL = `${REGISTRY_BASE_URL}/api/v3/domains/json`
const REGISTRY_DISTRIBUTORS_API_URL = `${REGISTRY_BASE_URL}/api/v3/ori/refused/json`
const REGISTRY_UNREGISTERED_RECORDS_API_URL = `${REGISTRY_BASE_URL}/registry-api/domains/`

const REGISTRY_STORAGE_DOMAINS_KEY = 'domains'
const REGISTRY_STORAGE_DISTRIBUTORS_KEY = 'distributors'
const REGISTRY_STORAGE_UNREGISTERED_RECORDS_KEY = 'unregisteredRecords'

class Registry {
  constructor () {
    setInterval(async () => {
      const day = new Date().getDate()
      const cleaningDays = [5, 15, 20, 25, 30]

      if (cleaningDays.includes(day)) {
        await storage.set({ blockedDomains: [] })
        console.warn('Outdated domains has been removed.')
      }

      await this.sendReport()
    }, 60 * 60 * 3000)
  }

  /**
   * Saves all the data from our registry in local storage.
   */
  sync = async () => {
    console.warn('Synchronizing local database with registry...')
    const apis = [
      {
        key: REGISTRY_STORAGE_DOMAINS_KEY,
        url: REGISTRY_DOMAINS_API_URL,
      },
      {
        key: REGISTRY_STORAGE_DISTRIBUTORS_KEY,
        url: REGISTRY_DISTRIBUTORS_API_URL,
      },
      {
        key: REGISTRY_STORAGE_UNREGISTERED_RECORDS_KEY,
        url: REGISTRY_UNREGISTERED_RECORDS_API_URL,
      },
    ]

    for (const { key, url } of apis) {
      try {
        const response = await fetch(url)
        const data = await response.json()

        await storage.set({ [key]: data })
      } catch (error) {
        console.error(`Error on fetching data from the API endpoint: ${url}`)
      }
    }

    const { domains, distributors } = await storage.get({
      [REGISTRY_STORAGE_DOMAINS_KEY]: [],
      [REGISTRY_STORAGE_DISTRIBUTORS_KEY]: [],
    })

    if (domains === [] || distributors === []) {
      console.log('Database is empty. Trying to sync...')
      await this.sync()
    }

    await storage.set({ timestamp: new Date().getTime() })
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

    for (const hostname of blockedDomains) {
      if (!alreadyReported.includes(hostname)) {
        await fetch(
          REGISTRY_LOGGING_API_URL, {
            method: 'POST',
            headers: {
              'Censortracker-D': new Date().getTime(),
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
