import * as storage from './storage'
import * as utilities from './utilities'

const IGNORE_API_ENDPOINT = 'https://app.censortracker.org/api/ignore/'

export class Ignore {
  /**
   * Fetches ignored domains from the API endpoint.
   */
  async fetch () {
    try {
      const { ignoreAPIEndpoint } = await storage.get({
        ignoreAPIEndpoint: IGNORE_API_ENDPOINT,
      })
      const ignoredHosts = await this.getAll()
      const response = await fetch(ignoreAPIEndpoint)
      const domains = await response.json()

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

  /**
   * Clears the list of ignored domains.
   */
  async clear () {
    await storage.set({ ignoredHosts: [] })
  }

  /**
   * Returns the list of all ignored domains.
   */
  async getAll () {
    const { ignoredHosts } = await storage.get({ ignoredHosts: [] })

    return ignoredHosts
  }

  /**
   * Adds a given URL to the list of ignored.
   * @param url URL to ignore.
   */
  async add (url) {
    const { ignoredHosts } = await storage.get({ ignoredHosts: [] })

    if (!ignoredHosts.includes(url)) {
      ignoredHosts.push(url)
      console.warn(`Adding ${url} to ignore`)
    }

    await storage.set({ ignoredHosts })
  }

  /**
   * Checks if a given URL is ignored..
   * @param url URL.
   */
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
