import * as storage from './storage'
import {
  extractDomainFromUrl,
} from './utilities'

class Registry {
  /**
   * Returns array of banned domains from the registry.
   */

  async getDomains () {
    const {
      domains,
      useRegistry,
      ignoredHosts,
      customProxiedDomains,
    } = await storage.get({
      domains: [],
      useRegistry: true,
      ignoredHosts: [],
      customProxiedDomains: [],
    })

    if (!useRegistry) {
      if (customProxiedDomains.length > 0) {
        return customProxiedDomains
      }
      return []
    }

    const allDomains = [
      ...domains,
      ...customProxiedDomains,
    ].filter((element) => {
      return !ignoredHosts.includes(element)
    })

    if (allDomains.length > 0) {
      return allDomains
    }
    return []
  }

  async isEmpty () {
    const domains = await this.getDomains()

    return domains.length === 0
  }

  async add (url) {
    const domain = extractDomainFromUrl(url)
    const { customProxiedDomains } =
      await storage.get({ customProxiedDomains: [] })

    if (!customProxiedDomains.includes(domain)) {
      customProxiedDomains.push(domain)
      await storage.set({ customProxiedDomains })
      console.warn(`${domain} added to the custom registry.`)
    }
    return true
  }

  async remove (url) {
    const domain = extractDomainFromUrl(url)
    const { customProxiedDomains } =
      await storage.get({ customProxiedDomains: [] })

    if (customProxiedDomains.includes(domain)) {
      const index = customProxiedDomains.indexOf(domain)

      customProxiedDomains.splice(index, 1)
      await storage.set({ customProxiedDomains })
      console.warn(`${domain} removed from custom registry`)
    }
    return true
  }

  /**
   * Checks if the given URL is in the registry of banned websites.
   */
  async contains (url) {
    const domain = extractDomainFromUrl(url)
    const {
      domains,
      ignoredHosts,
      customProxiedDomains,
    } = await storage.get({
      domains: [],
      ignoredHosts: [],
      customProxiedDomains: [],
    })

    if (ignoredHosts.includes(domain)) {
      return false
    }

    if (
      domains.includes(domain) ||
      customProxiedDomains.includes(domain)
    ) {
      return true
    }
    return false
  }

  /**
   * Checks if the given URL is in registry of IDO (Information Dissemination Organizer).
   * This method makes sense only for some countries (Russia).
   */
  async retrieveDisseminator (url) {
    const domain = extractDomainFromUrl(url)
    const { disseminators } = await storage.get({ disseminators: [] })

    const dataObject = disseminators.find(
      ({ url: innerUrl }) => domain === innerUrl,
    )

    if (dataObject) {
      return dataObject
    }
    return {}
  }

  async enableRegistry () {
    await storage.set({ useRegistry: true })
  }

  async disableRegistry () {
    await storage.set({ useRegistry: false })
  }

  async clearRegistry () {
    await storage.set({ domains: [] })
  }
}

export default new Registry()
