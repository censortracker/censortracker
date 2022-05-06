import * as storage from './storage'
import * as utilities from './utilities'

const IGNORE_API_ENDPOINT_URI = 'https://app.censortracker.org/api/ignore/'

export class Ignore {
  async fetch () {
    try {
      const ignoredHosts = await this.getAll()
      const response = await fetch(IGNORE_API_ENDPOINT_URI)
      const { domains } = await response.json()

      for (const domain of domains) {
        if (!ignoredHosts.includes(domain)) {
          ignoredHosts.push(domain)
        }
      }
      await storage.set({ ignoredHosts })
      console.log('Remote ignored domains fetched!')
    } catch (error) {
      console.warn('Fetching ignored domains...')
    }
  }

  async clear () {
    await storage.set({ ignoredHosts: [] })
  }

  async getAll () {
    const { ignoredHosts } = await storage.get({ ignoredHosts: [] })

    return ignoredHosts
  }

  async add (url) {
    const { ignoredHosts } = await storage.get({ ignoredHosts: [] })

    if (!ignoredHosts.includes(url)) {
      ignoredHosts.push(url)
      console.warn(`Adding ${url} to ignore`)
    }

    await storage.set({ ignoredHosts })
  }

  async contains (url) {
    const ignoredHosts = await this.getAll()
    const hostname = utilities.extractHostnameFromUrl(url)

    if (ignoredHosts.includes(hostname)) {
      console.warn(`Ignoring host: ${hostname}`)
      return true
    }
    return false
  }
}

export default new Ignore()
