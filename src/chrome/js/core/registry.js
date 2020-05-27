(function () {
  const DB_DOMAINS_ITEM_NAME = 'domains'
  const DB_DISTRIBUTORS_ITEM_NAME = 'distributors'
  const API_V3_DISTRIBUTORS = 'https://api.reserve-rbl.ru/api/v3/ori/refused/json'
  const API_V3_DOMAINS = 'https://api.reserve-rbl.ru/api/v3/domains/json'

  const db = window.database.create('censortracker-registry-db')

  const syncDatabase = () => {
    const apis = [
      {
        key: DB_DOMAINS_ITEM_NAME,
        url: API_V3_DOMAINS
      },
      {
        key: DB_DISTRIBUTORS_ITEM_NAME,
        url: API_V3_DISTRIBUTORS
      }
    ]
    for (const api of apis) {
      fetch(api.url)
        .then((resp) => resp.json())
        .then((domains) => {
          db.setItem(api.key, {
            domains: domains,
            timestamp: new Date().toLocaleString()
          })
            .then((_value) => {
              console.warn(`Local ${api.key} database updated`)
            })
            .catch((error) => {
              console.error(`Error on updating local ${api.key} database: ${error}`)
            })
        })
    }
  }

  const getLastSyncTimestamp = (callback) => {
    db.getItem(DB_DOMAINS_ITEM_NAME)
      .then((data) => {
        if (data && data.hasOwnProperty('timestamp')) {
          callback(data.timestamp)
        }
      })
      .catch((error) => {
        console.error(error)
      })
  }

  const checkDomains = (currentHostname, callbacks) => {
    const onMatchFoundCallback = callbacks.onMatchFound
    const onMatchNotFoundCallback = callbacks.onMatchNotFound

    db.getItem(DB_DOMAINS_ITEM_NAME)
      .then((data) => {
        if (!data) return
        const domains = data.domains

        const matchFound = domains.find(function (domain) {
          return currentHostname === shortcuts.cleanHostname(domain)
        })

        if (matchFound) {
          console.warn('Registry match found: ' + currentHostname)
          onMatchFoundCallback(data)
        } else {
          if (onMatchNotFoundCallback !== undefined) {
            onMatchNotFoundCallback()
          }
        }
      })
      .catch((error) => {
        console.error(error)
      })
  }

  const checkDistributors = (hostname, callbacks) => {
    const onMatchFoundCallback = callbacks.onMatchFound
    const onMatchNotFoundCallback = callbacks.onMatchNotFound

    db.getItem(DB_DISTRIBUTORS_ITEM_NAME)
      .then((distributors) => {
        if (!distributors) return
        const domains = distributors.domains
        let cooperationRefused = false

        const matchFound = domains.find(function (item) {
          return hostname === shortcuts.cleanHostname(item.url)
        })

        if (matchFound) {
          console.warn('Distributor match found: ' + hostname)
          if ('cooperation_refused' in matchFound) {
            cooperationRefused = matchFound.cooperation_refused
          }
          onMatchFoundCallback(cooperationRefused)
        } else {
          if (onMatchNotFoundCallback !== undefined) {
            onMatchNotFoundCallback()
          }
        }
      })
      .catch((error) => {
        console.error(error)
      })
  }

  const reportBlockedByDPI = (domain) => {
    chrome.storage.local.get(
      {
        alreadyReported: []
      },
      (data) => {
        const alreadyReported = data.alreadyReported
        if (!alreadyReported.includes(domain)) {
          fetch('https://ct-dev.rublacklist.net/api/domain/', {
            method: 'POST',
            headers: {
              'Censortracker-D': new Date().getTime(),
              'Censortracker-V': settings.getVersion(),
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              domain: domain
            })
          })
            .then((response) => response.json())
            .then((data) => {
              if (data && data.status === 200) {
                alreadyReported.push(domain)
                chrome.storage.local.set(
                  {
                    alreadyReported: alreadyReported
                  },
                  () => {
                    console.warn(`Reported: ${domain}`)
                  }
                )
              }
            })
        } else {
          console.warn(`The domain ${domain} reported`)
        }
      }
    )
  }

  window.registry = {
    syncDatabase: syncDatabase,
    checkDomains: checkDomains,
    checkDistributors: checkDistributors,
    getLastSyncTimestamp: getLastSyncTimestamp,
    reportBlockedByDPI: reportBlockedByDPI
  }
})()
