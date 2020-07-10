import db from './database'
import settings from './settings'
import shortcuts from './shortcuts'

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

      await db.set(key, {
        domains,
        timestamp: new Date().getTime(),
      })
        .catch((error) => {
          console.error(`Error on updating local ${key} database: ${JSON.stringify(error)}`)
        })
    }
    await this.updateLastSyncDate()
  }

  updateLastSyncDate = async () => {
    await db.set('lastSyncDate', new Date().toLocaleString()).catch((error) => {
      console.error(`Error on updating updateDate: ${error}`)
    })
  }

  getDomains = async () => {
    await this.syncDatabase()

    const { domains } = await db.get('domains')

    if (domains && Object.hasOwnProperty.call(domains, dbDomainItemName)) {
      try {
        return domains.domains
      } catch (error) {
        console.log(error)
        return []
      }
    }

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
