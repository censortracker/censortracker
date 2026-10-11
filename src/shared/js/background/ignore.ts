import browser from './browser-api'
import { findHostMatch } from './host-match'
import { extractHostnameFromUrl, removeDuplicates } from './utilities'

export class Ignore {
  /**
   * Clears the list of ignored domains.
   * @returns {Promise<undefined>}
   */
  async clear () {
    await browser.storage.local.set({ ignoredHosts: [] })
  }

  /**
   * Returns the list of all ignored domains.
   * @returns {Promise<string[]>}
   */
  async getAll () {
    const { ignoredHosts } =
      await browser.storage.local.get({ ignoredHosts: [] })

    return removeDuplicates(ignoredHosts)
  }

  /**
   * Adds a given URL to the list of ignored.
   * @param url URL to ignore.
   * @returns {Promise<boolean>}
   */
  async add (url: string) {
    const hostname = extractHostnameFromUrl(url)
    const ignoredHosts = await this.getAll()

    if (!hostname) {
      return false
    }
    if (!ignoredHosts.includes(hostname)) {
      ignoredHosts.push(hostname)
      console.info(`Adding ${hostname} to ignore`)
      await this.set(ignoredHosts)
    }
    return true
  }

  async set (ignoredHosts: string[] = []) {
    await browser.storage.local.set({
      ignoredHosts: removeDuplicates(ignoredHosts),
    })
  }

  /**
   * Removes a URL/Hostname from the list of ignored.
   * @param url URL to remove.
   * @returns {Promise<boolean>}
   */
  async remove (url: string) {
    const hostname = extractHostnameFromUrl(url)
    const ignoredHosts = await this.getAll()
    const remaining = ignoredHosts.filter((name) =>
      !findHostMatch(hostname, new Set([name])))

    if (remaining.length !== ignoredHosts.length) {
      await this.set(remaining)
      console.info(`Removing ${hostname} from ignore`)
    }
    return true
  }

  /**
   * Checks if a given URL is ignored..
   * @param url URL.
   * @returns {Promise<boolean>}
   */
  async contains (url: string) {
    const ignoredHosts = await this.getAll()
    const hostname = extractHostnameFromUrl(url)

    if (findHostMatch(hostname, new Set(ignoredHosts))) {
      console.debug(`Ignoring host: ${hostname}`)
      return true
    }
    return false
  }
}

export default new Ignore()
