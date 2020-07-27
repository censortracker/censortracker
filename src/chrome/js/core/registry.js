import asynchrome from './asynchrome'
import settings from './settings'

const DOMAINS_DB_KEY = 'domains'
const DISTRIBUTORS_DB_KEY = 'distributors'

class Registry {
  syncDatabase = async () => {
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
      })
        .catch((console.error))
    }

    const { domains } = await asynchrome.storage.local.get({ [DOMAINS_DB_KEY]: [] })

    if (!domains) {
      console.log('Database is empty. Trying to sync...')
      await this.syncDatabase()
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

  domainsContains = async (host) => {
    const { domains } = await asynchrome.storage.local.get({ [DOMAINS_DB_KEY]: [] })

    if (domains.find((domain) => host === domain)) {
      console.log(`Registry match found: ${host}`)
      return { domainFound: true }
    }
    console.log(`Registry match not found: ${host}`)
    return { domainFound: false }
  }

  distributorsContains = async (host) => {
    const { distributors } =
      await asynchrome.storage.local.get({ [DISTRIBUTORS_DB_KEY]: [] })

    const dataObject = distributors.find(({ url }) => (host === url))

    if (dataObject) {
      console.warn(`Distributor match found: ${host}`)
      return dataObject
    }
    console.warn(`Distributor match not found: ${host}`)
    return {}
  }

  addBlockedByDPI = async (hostname) => {
    if (!hostname) {
      return
    }
    const { blockedDomains } = await asynchrome.storage.local.get({ blockedDomains: [] })

    if (!blockedDomains.find(({ domain }) => domain === hostname)) {
      blockedDomains.push({
        domain: hostname,
        timestamp: new Date().getTime(),
      })
      await this.reportBlockedByDPI(hostname)
    }
    await asynchrome.storage.local.set({ blockedDomains })
  }

  reportBlockedByDPI = async (domain) => {
    const { alreadyReported } = await asynchrome.storage.local.get({ alreadyReported: [] })

    if (!alreadyReported.includes(domain)) {
      const response = await fetch(settings.getLoggingApiUrl(), {
        method: 'POST',
        headers: {
          'Censortracker-D': new Date().getTime(),
          'Censortracker-V': settings.getVersion(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ domain }),
      })
      const json = await response.json()

      alreadyReported.push(domain)
      await asynchrome.storage.local.set({ alreadyReported })

      return json
    }

    console.warn(`The domain ${domain} was already reported`)
    return null
  }
}

export default new Registry()
