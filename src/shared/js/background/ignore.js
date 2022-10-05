import * as storage from './storage'
import * as utilities from './utilities'
import { extractHostnameFromUrl } from './utilities'

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
    const hostname = extractHostnameFromUrl(url)
    const { ignoredHosts } = await storage.get({ ignoredHosts: [] })

    if (!ignoredHosts.includes(hostname)) {
      ignoredHosts.push(hostname)
      console.warn(`Adding ${hostname} to ignore`)
    }

    await storage.set({ ignoredHosts })
  }

  async remove (url) {
    const hostname = extractHostnameFromUrl(url)
    const { ignoredHosts } = await storage.get({ ignoredHosts: [] })

    if (ignoredHosts.includes(hostname)) {
      const index = ignoredHosts.indexOf(hostname)

      ignoredHosts.splice(index, 1)
      await storage.set({ ignoredHosts })
      console.warn(`Removing ${hostname} from ignore`)
    }
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
