import Browser from './browser-api'
import * as utilities from './utilities'
import { extractDomainFromUrl } from './utilities'

export class Ignore {
  /**
   * Clears the list of ignored domains.
   * @returns {Promise<undefined>}
   */
  async clear () {
    await Browser.storage.local.set({ ignoredHosts: [] })
  }

  /**
   * Returns the list of all ignored domains.
   * @returns {Promise<string[]>}
   */
  async getAll () {
    const { ignoredHosts } =
      await Browser.storage.local.get({ ignoredHosts: [] })

    return ignoredHosts
  }

  /**
   * Adds a given URL to the list of ignored.
   * @param url URL to ignore.
   * @returns {Promise<boolean>}
   */
  async add (url) {
    const hostname = extractDomainFromUrl(url)
    const { ignoredHosts } =
      await Browser.storage.local.get({ ignoredHosts: [] })

    if (!ignoredHosts.includes(hostname)) {
      ignoredHosts.push(hostname)
      console.warn(`Adding ${hostname} to ignore`)
      await Browser.storage.local.set({ ignoredHosts })
    }
    return true
  }

  async set (ignoredHosts = []) {
    await Browser.storage.local.set({ ignoredHosts })
  }

  /**
   * Removes a URL/Hostname from the list of ignored.
   * @param url URL to remove.
   * @returns {Promise<boolean>}
   */
  async remove (url) {
    const hostname = extractDomainFromUrl(url)
    const { ignoredHosts } =
      await Browser.storage.local.get({ ignoredHosts: [] })

    if (ignoredHosts.includes(hostname)) {
      const index = ignoredHosts.indexOf(hostname)

      ignoredHosts.splice(index, 1)
      await Browser.storage.local.set({ ignoredHosts })
      console.warn(`Removing ${hostname} from ignore`)
    }
    return true
  }

  /**
   * Checks if a given URL is ignored..
   * @param url URL.
   * @returns {Promise<boolean>}
   */
  async contains (url) {
    const ignoredHosts = await this.getAll()
    const hostname = utilities.extractDomainFromUrl(url)

    if (ignoredHosts.includes(hostname)) {
      console.warn(`Ignoring host: ${hostname}`)
      return true
    }
    return false
  }
}

export default new Ignore()
