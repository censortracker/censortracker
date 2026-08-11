import browser from './browser-api'
import {
  buildIgnoreIndex,
  isIgnoredHost,
  normalizeHostEntry,
  normalizeHostList,
} from './host-rules'
import { extractHostFromUrl, extractHostnameFromUrl } from './utilities'

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
   *
   * Normalized on the way out as well as on the way in: earlier versions stored
   * whatever `getDomain()` returned, which is `null` for every IP address and
   * for `localhost`, and those entries are still sitting in existing installs.
   * @returns {Promise<string[]>}
   */
  async getAll () {
    const { ignoredHosts } =
      await browser.storage.local.get({ ignoredHosts: [] })

    return normalizeHostList(ignoredHosts)
  }

  /**
   * Adds a given URL to the list of ignored.
   *
   * Stored as the registrable domain where there is one, so ignoring a site
   * from the popup covers its subdomains — and as the bare host where there is
   * not, which is what makes "never proxy 192.168.1.1" possible at all.
   * @param url URL to ignore.
   * @returns {Promise<boolean>}
   */
  async add (url) {
    const hostname = normalizeHostEntry(extractHostFromUrl(url))

    if (!hostname) {
      console.warn(`Could not work out a host to ignore from: ${url}`)
      return false
    }

    const ignoredHosts = await this.getAll()

    if (!ignoredHosts.includes(hostname)) {
      ignoredHosts.push(hostname)
      console.log(`Adding ${hostname} to ignore`)
    }
    // Written back even when the host was already there: `getAll()` may have
    // just cleaned up entries an older version stored.
    await browser.storage.local.set({ ignoredHosts })
    return true
  }

  async set (ignoredHosts = []) {
    await browser.storage.local.set({
      ignoredHosts: normalizeHostList(ignoredHosts),
    })
  }

  /**
   * Removes a URL/Hostname from the list of ignored.
   * @param url URL to remove.
   * @returns {Promise<boolean>}
   */
  async remove (url) {
    const hostname = normalizeHostEntry(extractHostFromUrl(url))
    const ignoredHosts = await this.getAll()
    const index = ignoredHosts.indexOf(hostname)

    if (hostname && index !== -1) {
      ignoredHosts.splice(index, 1)
      await browser.storage.local.set({ ignoredHosts })
      console.log(`Removing ${hostname} from ignore`)
    }
    return true
  }

  /**
   * Checks if a given URL is ignored.
   *
   * Asked of the full host and answered the way the PAC answers it — an entry
   * covers its subdomains — so the popup cannot report a site as proxied while
   * the routing is sending it direct.
   * @param url URL.
   * @returns {Promise<boolean>}
   */
  async contains (url) {
    const index = buildIgnoreIndex(await this.getAll())
    const hostname = extractHostnameFromUrl(url)

    if (isIgnoredHost(hostname, index)) {
      console.log(`Ignoring host: ${hostname}`)
      return true
    }
    return false
  }
}

export default new Ignore()
