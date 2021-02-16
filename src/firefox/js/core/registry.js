import { extractHostnameFromUrl, settings, storage } from '.'

class Registry {
  sync = async () => {
    console.warn('Synchronizing local database with registry...')
    const apis = [
      {
        key: 'domains',
        url: settings.getDomainsApiUrl(),
      },
      {
        key: 'distributors',
        url: settings.getDistributorsApiUrl(),
      },
    ]
    const timestamp = new Date().getTime()

    for (const { key, url } of apis) {
      const response = await fetch(url)
      const data = await response.json()

      await storage.set({ [key]: data, timestamp })
    }

    const { domains } = await storage.get({ domains: [] })

    if (!domains) {
      console.log('Database is empty. Trying to sync...')
      await this.sync()
    }
    return true
  }

  domainsContains = async (url) => {
    const hostname = extractHostnameFromUrl(url)
    const { domains, blockedDomains } =
      await storage.get({
        domains: [],
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
    const { distributors } =
      await storage.get({ distributors: [] })

    const dataObject = distributors.find(({ url: innerUrl }) => (hostname === innerUrl))

    if (dataObject) {
      return dataObject
    }
    return {}
  }

  sendReport = async (hostname) => {
    const { alreadyReported } = await storage.get({
      alreadyReported: new Set(),
    })

    if (!alreadyReported.has(hostname)) {
      await fetch(settings.getLoggingApiUrl(), {
        method: 'POST',
        headers: settings.getLoggingApiHeaders(),
        body: JSON.stringify({ hostname }),
      })
      alreadyReported.add(hostname)
      await storage.set({ alreadyReported })
      console.warn(`Reported new lock: ${hostname}`)
    }
  }

  add = async (hostname) => {
    const { blockedDomains } = await storage.get({ blockedDomains: [] })

    if (!blockedDomains.includes(hostname)) {
      blockedDomains.push(hostname)
      this.sendReport(hostname).then()
    }

    await storage.set({ blockedDomains })
  }
}

export default new Registry()
