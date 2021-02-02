import settings from './settings'
import storage from './storage'
import { extractHostnameFromUrl } from './utilities'

const DOMAINS_DB_KEY = 'domains'
const DISTRIBUTORS_DB_KEY = 'distributors'

class Registry {
  sync = async () => {
    console.warn('Synchronizing local database with registry...')
    const apis = [
      {
        key: DOMAINS_DB_KEY,
        url: settings.getDomainsApiUrl(),
      },
      {
        key: DISTRIBUTORS_DB_KEY,
        url: settings.getDistributorsApiUrl(),
      },
    ]

    for (const { key, url } of apis) {
      const response = await fetch(url).catch(console.error)
      const domains = await response.json()

      await storage.set({
        [key]: domains,
        timestamp: new Date().getTime(),
      }).catch(console.error)
    }

    const { domains } = await storage.get({ [DOMAINS_DB_KEY]: [] })

    if (!domains) {
      console.log('Database is empty. Trying to sync...')
      await this.sync()
    }
    return true
  }

  domainsContains = async (url) => {
    const hostname = extractHostnameFromUrl(url)
    const { domains, blockedDomains } =
      await storage.get({
        [DOMAINS_DB_KEY]: [],
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
      await storage.get({ [DISTRIBUTORS_DB_KEY]: [] })

    const dataObject = distributors.find(({ url: innerUrl }) => (hostname === innerUrl))

    if (dataObject) {
      return dataObject
    }
    return {}
  }

  add = async (hostname) => {
    await storage.set({ key: hostname })
    const { blockedDomains } = await storage.get({ blockedDomains: [] })

    if (!blockedDomains.includes(hostname)) {
      blockedDomains.push(hostname)
      // await this.sendReport(hostname)
    }

    await storage.set({ blockedDomains })
    console.warn(`Blocked domains: ${blockedDomains}`)
  }

  sendReport = async (domain) => {
    const { alreadyReported } = await storage.get({ alreadyReported: [] })

    if (!alreadyReported.includes(domain)) {
      const response = await fetch(settings.getLoggingApiUrl(), {
        method: 'POST',
        headers: settings.getLoggingApiHeaders(),
        body: JSON.stringify({ domain }),
      })
      const json = await response.json()

      alreadyReported.push(domain)
      await storage.set({ alreadyReported })
      console.warn(`Reported possible DPI lock: ${domain}`)
      return json
    }
    return null
  }
}

export default new Registry()
