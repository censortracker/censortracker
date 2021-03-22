import storage from './storage'
import { extractHostnameFromUrl } from './utilities'

const REGISTRY_BASE_URL = 'https://reestr.rublacklist.net'
const REGISTRY_LOGGING_API_URL = 'https://ct.rublacklist.net/api/case/'
const REGISTRY_DOMAINS_API_URL = `${REGISTRY_BASE_URL}/api/v3/domains/json`
const REGISTRY_DISTRIBUTORS_API_URL = `${REGISTRY_BASE_URL}/api/v3/ori/refused/json`
const REGISTRY_CUSTOM_RECORDS_API_URL = `${REGISTRY_BASE_URL}/registry-api/domains/`

class Registry {
  constructor () {
    setInterval(async () => {
      const day = new Date().getDate()
      const cleanDays = [5, 15, 20, 25, 30]

      if (cleanDays.includes(day)) {
        await storage.set({ blockedDomains: [] })
        console.warn('Outdated domains has been removed.')
      }

      await this.sendReport()
      console.log('The scheduled report has been sent!')
    }, 60 * 60 * 3000)
  }

  sync = async () => {
    console.warn('Synchronizing local database with registry...')
    const apis = [
      {
        key: 'domains',
        url: REGISTRY_DOMAINS_API_URL,
      },
      {
        key: 'distributors',
        url: REGISTRY_DISTRIBUTORS_API_URL,
      },
      {
        key: 'customRecords',
        url: REGISTRY_CUSTOM_RECORDS_API_URL,
      },
    ]
    const timestamp = new Date().getTime()

    for (const { key, url } of apis) {
      const response = await fetch(url)
      const data = await response.json()

      await storage.set({ [key]: data, timestamp })
    }

    const { domains } = await storage.get({ domains: [] })

    if (!domains) {
      console.log('Database is empty. Trying to sync...')
      await this.sync()
    }
    return true
  }

  getCustomRecords = async () => {
    const { customRecords } = await storage.get({ customRecords: [] })

    return customRecords
  }

  getDomains = async () => {
    const { domains, blockedDomains } =
      await storage.get({ domains: [], blockedDomains: [] })

    if (domains && domains.length > 0) {
      try {
        return domains.concat(blockedDomains)
      } catch (error) {
        console.log(error)
      }
    }
    return []
  }

  domainsContains = async (url) => {
    const hostname = extractHostnameFromUrl(url)
    const { domains, blockedDomains } =
      await storage.get({
        domains: [],
        blockedDomains: [],
      })

    const domainsArray = domains.concat(blockedDomains)

    if (domainsArray.includes(hostname)) {
      console.log(`Registry match found: ${hostname}`)
      return { domainFound: true }
    }
    return { domainFound: false }
  }

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

  add = async (hostname) => {
    const { blockedDomains } = await storage.get({ blockedDomains: [] })

    if (!blockedDomains.includes(hostname)) {
      blockedDomains.push(hostname)
    }
    await storage.set({ blockedDomains })
  }
}

export default new Registry()
