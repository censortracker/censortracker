import db from './database'
import settings from './settings'
import shortcuts from './shortcuts'
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

    const { domains } = await db.get(dbDomainItemName)

    if (!domains) {
      console.log('Database is empty. Trying to sync...')
      await this.syncDatabase()
    }
    return true
  }

  getDomains = async () => {
    const { domains } = await db.get('domains')
    const { blockedDomains } = await db.get({ blockedDomains: [] })
    const blockedDomainsArray = blockedDomains.map(({ domain }) => domain)

    if (domains && Object.hasOwnProperty.call(domains, dbDomainItemName)) {
      try {
        return domains.domains.concat(blockedDomainsArray)
      } catch (error) {
        console.log(error)
        return []
      }
    }

    console.warn('getDomains: domains not found')
    return []
  }

  domainsContains = (host) => new Promise((resolve, reject) => {
    db.get(dbDomainItemName)
      .then(({ [dbDomainItemName]: { domains } }) => {
        const found = domains.find((domain) => {
          return host === shortcuts.cleanHostname(domain)
        })

        if (found) {
          resolve({ domainFound: true })
          console.log(`Registry match found: ${host}`)
        } else {
          resolve({ domainFound: false })
          console.log(`Registry match not found: ${host}`)
        }
      })
      .catch(reject)
  })

  distributorsContains = (host) => new Promise((resolve, reject) => {
    db.get(dbDistributorsItemName)
      .then(({ [dbDistributorsItemName]: { domains } }) => {
        const dataObject = domains.find((item) => (
          host === shortcuts.cleanHostname(item.url)
        ))

        if (dataObject) {
          console.warn(`Distributor match found: ${host}`)
          resolve(dataObject)
        } else {
          console.warn(`Distributor match not found: ${host}`)
          resolve({})
        }
      })
      .catch(reject)
  })

  addBlockedByDPI = async (hostname) => {
    if (!hostname) {
      return
    }
    const { blockedDomains } = await db.get({ blockedDomains: [] })

    const isBlocked = blockedDomains.find(({ domain }) => domain === hostname)

    if (!isBlocked) {
      blockedDomains.push({
        domain: hostname,
        timestamp: new Date().getTime(),
      })
    } else {
      console.warn(`(${this.addBlockedByDPI.name}) The domain already in local registry: ${hostname}`)
    }

    await db.set('blockedDomains', blockedDomains)
    await this.reportBlockedByDPI(hostname)
  }

  reportBlockedByDPI = async (domain) => {
    const { alreadyReported } = await db.get('alreadyReported')

    if (alreadyReported && !alreadyReported.includes(domain)) {
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
      await db.set('alreadyReported', alreadyReported)

      return json
    }

    console.warn(`The domain ${domain} was already reported`)
    return null
  }
}

export default new Registry()
