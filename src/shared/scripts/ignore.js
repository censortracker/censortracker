import * as storage from './storage'
import * as utilities from './utilities'

const IGNORE_FETCH_INTERVAL = (60 * 15) * 1000
const IGNORE_API_ENDPOINT_URI = 'https://app.censortracker.org/api/ignore/'

class Ignore {
  constructor () {
    setInterval(async () => {
      await this.fetch() // TODO: Use alarm instead
    }, IGNORE_FETCH_INTERVAL)
  }

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
    const hostname = utilities.extractHostnameFromUrl(url)
    const { ignoredHosts } = await storage.get({ ignoredHosts: [] })

    if (!ignoredHosts.includes(hostname)) {
      ignoredHosts.push(hostname)
      console.warn(`Adding ${hostname} to ignore`)
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
