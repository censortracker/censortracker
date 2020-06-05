import { Database, settings, shortcuts } from './index'

const dbDomainItemName = 'domains'
const dbDistributorsItemName = 'distributors'
const db = new Database('censortracker-registry-db')

class Registry {
  syncDatabase = async () => {
    const apis = [
      {
        key: dbDomainItemName,
        url: settings.getDomainsApiUrl(),
      },
      {
        key: dbDistributorsItemName,
        url: settings.getRefusedApiUrl(),
      },
    ]

    for (const { key, url } of apis) {
      const response = await fetch(url)
      const domains = await response.json()

      await db.set(key, { domains, timestamp: new Date().getTime() })
        .catch((error) => {
          console.error(`Error on updating local ${key} database: ${error}`)
        })
    }
  }

  getLastSyncTimestamp = () => new Promise((resolve, reject) => {
    db.get(dbDomainItemName)
      .then((data) => {
        if (data && data.timestamp) {
          resolve(data.timestamp)
        }
      })
      .catch(reject)
  })

  checkDomains = (currentHostname, callbacks) => {
    const onMatchFoundCallback = callbacks.onMatchFound
    const onMatchNotFoundCallback = callbacks.onMatchNotFound

    db.get(dbDomainItemName)
      .then((data) => {
        if (!data) {
          return
        }
        const domains = data.domains

        const matchFound = domains.find((domain) => {
          return currentHostname === shortcuts.cleanHostname(domain)
        })

        if (matchFound) {
          console.warn(`Registry match found: ${currentHostname}`)
          onMatchFoundCallback(data)
        } else if (onMatchNotFoundCallback !== undefined) {
          onMatchNotFoundCallback()
        }
      })
      .catch((error) => {
        console.error(error)
      })
  }

  checkDistributors = (hostname, callbacks) => {
    const onMatchFoundCallback = callbacks.onMatchFound
    const onMatchNotFoundCallback = callbacks.onMatchNotFound

    db.get(dbDistributorsItemName)
      .then((distributors) => {
        if (!distributors) {
          return
        }
        const domains = distributors.domains
        let cooperationRefused = false

        const matchFound = domains.find(function (item) {
          return hostname === shortcuts.cleanHostname(item.url)
        })

        if (matchFound) {
          console.warn(`Distributor match found: ${hostname}`)
          if ('cooperation_refused' in matchFound) {
            cooperationRefused = matchFound.cooperation_refused
          }
          onMatchFoundCallback(cooperationRefused)
        } else if (onMatchNotFoundCallback !== undefined) {
          onMatchNotFoundCallback()
        }
      })
      .catch((error) => {
        console.error(error)
      })
  }

  reportBlockedByDPI = (domain) => {
    chrome.storage.local.get(
      {
        alreadyReported: [],
      },
      (data) => {
        const alreadyReported = data.alreadyReported

        if (!alreadyReported.includes(domain)) {
          fetch(settings.getLoggingApiUrl(), {
            method: 'POST',
            headers: {
              'Censortracker-D': new Date().getTime(),
              'Censortracker-V': settings.getVersion(),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              domain,
            }),
          })
            .then((response) => response.json())
            .then((response) => {
              if (response && response.status === 200) {
                alreadyReported.push(domain)
                chrome.storage.local.set(
                  {
                    alreadyReported,
                  },
                  () => {
                    console.warn(`Reported: ${domain}`)
                  },
                )
              }
            })
        } else {
          console.warn(`The domain ${domain} reported`)
        }
      },
    )
  }
}

export default new Registry()
