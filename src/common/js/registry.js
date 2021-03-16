import storage from './storage'
import { extractHostnameFromUrl } from './utilities'

const BASE_URL = 'https://reestr.rublacklist.net'
const DOMAINS_API_URL = `${BASE_URL}/api/v3/domains/json`
const DISTRIBUTORS_API_URL = `${BASE_URL}/api/v3/ori/refused/json`
const LOGGING_API_URL = 'https://ct-dev.rublacklist.net/api/case/'
const CUSTOM_RECORDS_API_URL = `${BASE_URL}/registry-api/domains/`

class Registry {
  sync = async () => {
    console.warn('Synchronizing local database with registry...')
    const apis = [
      {
        key: 'domains',
        url: DOMAINS_API_URL,
      },
      {
        key: 'distributors',
        url: DISTRIBUTORS_API_URL,
      },
      {
        key: 'customRecords',
        url: CUSTOM_RECORDS_API_URL,
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

    const blockedDomainsArray = blockedDomains.map(({ domain }) => domain)

    if (domains && domains.length > 0) {
      try {
        return domains.concat(blockedDomainsArray)
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

  // TODO: Report domains automatically
  sendReport = async (hostname) => {
    const { alreadyReported } = await storage.get({
      alreadyReported: [],
    })

    if (!alreadyReported.includes(hostname)) {
      await fetch(
        LOGGING_API_URL, {
          method: 'POST',
          headers: {
            'Censortracker-D': new Date().getTime(),
            'Censortracker-V': '3.0.0',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ hostname }),
        })
      alreadyReported.push(hostname)
      await storage.set({ alreadyReported })
      console.warn(`Reported new lock: ${hostname}`)
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
