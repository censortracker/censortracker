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

      await browser.storage.local.set({
        [key]: domains,
        timestamp: new Date().getTime(),
      }).catch(console.error)
    }

    const { domains } = await browser.storage.local.get({ [DOMAINS_DB_KEY]: [] })

    if (!domains) {
      console.log('Database is empty. Trying to sync...')
      await this.syncDatabase()
    }
    return true
  }

  getDomains = async () => {
    const { domains, blockedDomains } =
      await browser.storage.local.get({ [DOMAINS_DB_KEY]: [], blockedDomains: [] })

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
    const { domains, blockedDomains } =
      await browser.storage.local.get({
        [DOMAINS_DB_KEY]: [],
        blockedDomains: [],
      })

    const domainsArray = domains.concat(blockedDomains)

    if (domainsArray.includes(host)) {
      console.log(`Registry match found: ${host}`)
      return { domainFound: true }
    }
    return { domainFound: false }
  }

  distributorsContains = async (host) => {
    const { distributors } =
      await browser.storage.local.get({ [DISTRIBUTORS_DB_KEY]: [] })

    const dataObject = distributors.find(({ url }) => (host === url))

    if (dataObject) {
      console.warn(`Distributor match found: ${host}`)
      return dataObject
    }
    return {}
  }

  addBlockedByDPI = async (hostname) => {
    if (!hostname) {
      return
    }
    const { blockedDomains } = await browser.storage.local.get({ blockedDomains: [] })

    if (!blockedDomains.find(({ domain }) => domain === hostname)) {
      blockedDomains.push({
        domain: hostname,
        timestamp: new Date().getTime(),
      })
      await this.reportBlockedByDPI(hostname)
    }
    await browser.storage.local.set({ blockedDomains })
  }

  reportBlockedByDPI = async (domain) => {
    const { alreadyReported } = await browser.storage.local.get({ alreadyReported: [] })

    if (!alreadyReported.includes(domain)) {
      const response = await fetch(settings.getLoggingApiUrl(), {
        method: 'POST',
        headers: settings.getLoggingApiHeaders(),
        body: JSON.stringify({ domain }),
      })
      const json = await response.json()

      alreadyReported.push(domain)
      await browser.storage.local.set({ alreadyReported })
      console.warn(`Reported possible DPI lock: ${domain}`)
      return json
    }
    return null
  }
}

export default new Registry()
