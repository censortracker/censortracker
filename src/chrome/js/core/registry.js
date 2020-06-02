;(function () {
  const dbDomainItemName = 'domains'
  const dbDistributorsItemName = 'distributors'
  const db = window.database.create('censortracker-registry-db')

  const syncDatabase = () => {
    const apis = [
      {
        key: dbDomainItemName,
        url: window.settings.getDomainsApiUrl(),
      },
      {
        key: dbDistributorsItemName,
        url: window.settings.getRefusedApiUrl(),
      },
    ]

    for (const api of apis) {
      fetch(api.url)
        .then((resp) => resp.json())
        .then((domains) => {
          db.setItem(api.key, {
            domains: domains,
            timestamp: new Date().toLocaleString(),
          })
            .then((_value) => {
              console.warn(`Local ${api.key} database updated`)
            })
            .catch((error) => {
              console.error(
                `Error on updating local ${api.key} database: ${error}`,
              )
            })
        })
    }
  }

  const getLastSyncTimestamp = (callback) => {
    db.getItem(dbDomainItemName)
      .then((data) => {
        if (data && Object.prototype.hasOwnProperty.call(data, 'timestamp')) {
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

    db.getItem(dbDomainItemName)
      .then((data) => {
        if (!data) return
        const domains = data.domains

        const matchFound = domains.find(function (domain) {
          return currentHostname === window.shortcuts.cleanHostname(domain)
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

    db.getItem(dbDistributorsItemName)
      .then((distributors) => {
        if (!distributors) return
        const domains = distributors.domains
        let cooperationRefused = false

        const matchFound = domains.find(function (item) {
          return hostname === window.shortcuts.cleanHostname(item.url)
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
        alreadyReported: [],
      },
      (data) => {
        const alreadyReported = data.alreadyReported
        if (!alreadyReported.includes(domain)) {
          fetch(window.settings.getLoggingApiUrl(), {
            method: 'POST',
            headers: {
              'Censortracker-D': new Date().getTime(),
              'Censortracker-V': window.settings.getVersion(),
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              domain: domain,
            }),
          })
            .then((response) => response.json())
            .then((data) => {
              if (data && data.status === 200) {
                alreadyReported.push(domain)
                chrome.storage.local.set(
                  {
                    alreadyReported: alreadyReported,
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

  window.registry = {
    syncDatabase: syncDatabase,
    checkDomains: checkDomains,
    checkDistributors: checkDistributors,
    getLastSyncTimestamp: getLastSyncTimestamp,
    reportBlockedByDPI: reportBlockedByDPI,
  }
})()
