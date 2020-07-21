import settings from './settings'
import asynchrome from './asynchrome'

const dbDomainItemName = 'domains'
const dbDistributorsItemName = 'distributors'

class Registry {
  syncDatabase = async () => {
    console.warn('Synchronizing local database with registry...')
    const apis = [
      {
        key: dbDomainItemName,
        url: settings.getDomainsApiUrl(),
      },
      {
        key: dbDistributorsItemName,
        url: settings.getDistributorsApiUrl(),
      },
    ]

    for (const { key, url } of apis) {
      const response = await fetch(url).catch(console.error)
      const domains = await response.json()

      await asynchrome.storage.local.set({
        [key]: {
          domains, timestamp: new Date().getTime(),
        },
      })
        .catch((console.error))
    }

    const { domains } = await asynchrome.storage.local.get({ [dbDomainItemName]: {} })

    if (!domains) {
      console.log('Database is empty. Trying to sync...')
      await this.syncDatabase()
    }
    return true
  }

  getDomains = async () => {
    const { domains } =
      await asynchrome.storage.local.get({ domains: {} })
    const { blockedDomains } =
      await asynchrome.storage.local.get({ blockedDomains: [] })

    const blockedDomainsArray = blockedDomains.map(({ domain }) => domain)

    if (domains && Object.hasOwnProperty.call(domains, dbDomainItemName)) {
      try {
        return domains.domains.concat(blockedDomainsArray)
      } catch (error) {
        console.log(error)
      }
    }

    console.warn('getDomains: domains not found')
    return []
  }

  domainsContains = async (host) => {
    const { [dbDomainItemName]: { domains } } =
      await asynchrome.storage.local.get(dbDomainItemName)

    if (domains.find((domain) => host === domain)) {
      console.log(`Registry match found: ${host}`)
      return { domainFound: true }
    }
    console.log(`Registry match not found: ${host}`)
    return { domainFound: false }
  }

  distributorsContains = async (host) => {
    const { [dbDistributorsItemName]: { domains } } =
      await asynchrome.storage.local.get(dbDistributorsItemName)

    const dataObject = domains.find(({ url }) => (host === url))

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
