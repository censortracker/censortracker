import browser from './browser-api'
import {
  extractDomainFromUrl,
} from './utilities'

// Storage keys that make up the registry state. A change to any of them (from
// any extension context) drops the in-memory snapshot below.
const REGISTRY_STORAGE_KEYS = [
  'domains',
  'useRegistry',
  'ignoredHosts',
  'disseminators',
  'customProxiedDomains',
]

// In-memory snapshot of the registry data. The blocklist can contain tens of
// thousands of domains, and the tab/navigation handlers query it on every
// page load — re-reading and re-deserializing it from storage each time is
// the most expensive repeated operation in the extension. The snapshot is
// built on first use and invalidated through storage.onChanged, so it can
// never go stale (storage stays the single source of truth). The promise
// itself is memoized so concurrent cold-cache callers (e.g. the popup checks
// many domains via Promise.all) share ONE storage read instead of racing.
let registryStatePromise = null

const getRegistryState = () => {
  if (!registryStatePromise) {
    registryStatePromise = browser.storage.local.get({
      domains: [],
      useRegistry: true,
      ignoredHosts: [],
      disseminators: [],
      customProxiedDomains: [],
    }).then(({
      domains,
      useRegistry,
      ignoredHosts,
      disseminators,
      customProxiedDomains,
    }) => ({
      useRegistry,
      disseminators,
      domains: new Set(domains),
      ignoredHosts: new Set(ignoredHosts),
      customProxiedDomains: new Set(customProxiedDomains),
    }))

    // A failed read must not be cached forever; let the next call retry.
    registryStatePromise.catch(() => {
      registryStatePromise = null
    })
  }
  return registryStatePromise
}

if (browser.storage && browser.storage.onChanged) {
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (
      areaName === 'local' &&
      REGISTRY_STORAGE_KEYS.some((key) => key in changes)
    ) {
      registryStatePromise = null
    }
  })
}

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
    } = await getRegistryState()

    if (!useRegistry) {
      return [...customProxiedDomains]
    }

    const allDomains = []

    for (const domain of domains) {
      if (!ignoredHosts.has(domain)) {
        allDomains.push(domain)
      }
    }
    for (const domain of customProxiedDomains) {
      if (!domains.has(domain) && !ignoredHosts.has(domain)) {
        allDomains.push(domain)
      }
    }
    return allDomains
  }

  async isEmpty () {
    const domains = await this.getDomains()

    return domains.length === 0
  }

  async add (url) {
    const domain = extractDomainFromUrl(url)
    const { customProxiedDomains } =
      await browser.storage.local.get({ customProxiedDomains: [] })

    if (!customProxiedDomains.includes(domain)) {
      customProxiedDomains.push(domain)
      await browser.storage.local.set({ customProxiedDomains })
      console.warn(`${domain} added to the custom registry.`)
    }
    return true
  }

  async remove (url) {
    const domain = extractDomainFromUrl(url)
    const { customProxiedDomains } =
      await browser.storage.local.get({ customProxiedDomains: [] })

    if (customProxiedDomains.includes(domain)) {
      const index = customProxiedDomains.indexOf(domain)

      customProxiedDomains.splice(index, 1)
      await browser.storage.local.set({ customProxiedDomains })
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
    } = await getRegistryState()

    if (ignoredHosts.has(domain)) {
      return false
    }

    return domains.has(domain) || customProxiedDomains.has(domain)
  }

  /**
   * Checks if the given URL is in registry of IDO (Information Dissemination Organizer).
   * This method makes sense only for some countries (Russia).
   */
  async retrieveDisseminator (url) {
    const domain = extractDomainFromUrl(url)
    const { disseminators } = await getRegistryState()

    const dataObject = disseminators.find(
      ({ url: innerUrl }) => domain === innerUrl,
    )

    if (dataObject) {
      return dataObject
    }
    return {}
  }

  async enableRegistry () {
    await browser.storage.local.set({ useRegistry: true })
  }

  async disableRegistry () {
    await browser.storage.local.set({ useRegistry: false })
  }

  async clearRegistry () {
    await browser.storage.local.set({ domains: [] })
  }
}

export default new Registry()
