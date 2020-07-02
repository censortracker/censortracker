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

  getLastSyncDate = () => new Promise((resolve, reject) => {
    db.get('lastSyncDate')
      .then(({ lastSyncDate }) => {
        if (lastSyncDate) {
          resolve(lastSyncDate.replace(/\//g, '.'))
        }
      })
      .catch(reject)
  })

  getDomains = async () => {
    await this.syncDatabase()

    const { domains } = await db.get('domains')

    if (domains && Object.hasOwnProperty.call(domains, dbDomainItemName)) {
      return domains.domains
    }

    return []
  }

  domainsContains = (host) => new Promise((resolve, reject) => {
    db.get(dbDomainItemName)
      .then(({ [dbDomainItemName]: { domains } }) => {
        const found = domains.find((domain) => {
          return host === shortcuts.cleanHostname(domain)
        })

        // TODO: Pass matched domains instead of array of domains
        if (found) {
          console.warn(`Registry match found: ${host}`)
          resolve(domains)
        } else {
          console.log(`Registry match not found: ${host}`)
          resolve([])
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
