import { extractHostnameFromUrl } from '../../../common/js/utilities'
import asynchrome from './asynchrome'
import settings from './settings'

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

      await asynchrome.storage.local.set({
        [key]: domains,
        timestamp: new Date().getTime(),
      }).catch(console.error)
    }

    const { domains } = await asynchrome.storage.local.get({ [DOMAINS_DB_KEY]: [] })

    if (!domains) {
      console.log('Database is empty. Trying to sync...')
      await this.sync()
    }
    return true
  }

  getDomains = async () => {
    const { domains, blockedDomains } =
      await asynchrome.storage.local.get({ [DOMAINS_DB_KEY]: [], blockedDomains: [] })

    const blockedDomainsArray = blockedDomains.map(({ domain }) => domain)

    if (domains && domains.length > 0) {
      try {
        return domains.concat(blockedDomainsArray)
      } catch (error) {
        console.log(error)
      }
    }

    console.warn('getDomains: domains not found')
    return []
  }

  domainsContains = async (url) => {
    const hostname = extractHostnameFromUrl(url)
    const { domains, blockedDomains } =
      await asynchrome.storage.local.get({
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
    const { distributors } = await asynchrome.storage.local.get({
      [DISTRIBUTORS_DB_KEY]: [],
    })

    const dataObject = distributors.find(({ url: innerUrl }) => (hostname === innerUrl))

    if (dataObject) {
      return dataObject
    }
    return {}
  }

  add = async (hostname) => {
    if (!hostname) {
      return
    }
    const { blockedDomains } = await asynchrome.storage.local.get({ blockedDomains: [] })

    if (!blockedDomains.find(({ domain }) => domain === hostname)) {
      blockedDomains.push({
        domain: hostname,
        timestamp: new Date().getTime(),
      })
      await this.sendReport(hostname)
    }
    await asynchrome.storage.local.set({ blockedDomains })
  }

  sendReport = async (domain) => {
    const { alreadyReported } = await asynchrome.storage.local.get({ alreadyReported: [] })

    if (!alreadyReported.includes(domain)) {
      const response = await fetch(settings.getLoggingApiUrl(), {
        method: 'POST',
        headers: settings.getLoggingApiHeaders(),
        body: JSON.stringify({ domain }),
      })
      const json = await response.json()

      alreadyReported.push(domain)
      await asynchrome.storage.local.set({ alreadyReported })
      console.warn(`Reported possible DPI lock: ${domain}`)
      return json
    }
    return null
  }
}

export default new Registry()
