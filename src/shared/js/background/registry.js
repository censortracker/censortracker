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
  'externalBlocklistDomains',
  'useExternalBlocklist',
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
      externalBlocklistDomains: [],
      useExternalBlocklist: false,
    }).then(({
      domains,
      useRegistry,
      ignoredHosts,
      disseminators,
      customProxiedDomains,
      externalBlocklistDomains,
      useExternalBlocklist,
    }) => ({
      useRegistry,
      useExternalBlocklist,
      // Kept as its own set rather than folded into the user's own list: it
      // runs to hundreds of thousands of entries, and mixing it in would bury
      // the handful of domains they curated by hand with no way back.
      externalBlocklist: useExternalBlocklist
        ? new Set(externalBlocklistDomains)
        : new Set(),
      // Storage can still hold a non-array from a sync that predates the
      // validation in server.js, and retrieveDisseminator() calls .find() on
      // this for every tab load.
      disseminators: Array.isArray(disseminators) ? disseminators : [],
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
      externalBlocklist,
    } = await getRegistryState()

    const seen = new Set()
    const allDomains = []
    const push = (domain) => {
      if (!ignoredHosts.has(domain) && !seen.has(domain)) {
        seen.add(domain)
        allDomains.push(domain)
      }
    }

    if (useRegistry) {
      for (const domain of domains) {
        push(domain)
      }
    }
    for (const domain of customProxiedDomains) {
      push(domain)
    }
    // The imported blocklist is additive and independent of `useRegistry`:
    // it is the user's own choice to load it, and switching the official
    // registry off is not a reason to discard it.
    for (const domain of externalBlocklist) {
      push(domain)
    }
    return allDomains
  }

  async isEmpty () {
    const domains = await this.getDomains()

    return domains.length === 0
  }

  /**
   * Stores an imported third-party blocklist, replacing any previous one, and
   * switches it on. Kept apart from the official registry and from the user's
   * own list so it can be turned off or dropped without touching either.
   * @param {Array<string>} domains
   * @param {{source?: string}} [options]
   * @returns {Promise<number>} How many distinct domains were stored.
   */
  async setExternalBlocklist (domains, { source = '' } = {}) {
    const unique = [...new Set(
      (Array.isArray(domains) ? domains : [])
        .filter((domain) => typeof domain === 'string' && domain),
    )]

    await browser.storage.local.set({
      externalBlocklistDomains: unique,
      useExternalBlocklist: unique.length > 0,
      externalBlocklistSource: source,
      externalBlocklistUpdatedAt: unique.length > 0 ? Date.now() : 0,
    })
    return unique.length
  }

  /**
   * @returns {Promise<{count: number, enabled: boolean, source: string,
   *   updatedAt: number}>}
   */
  async getExternalBlocklistInfo () {
    const {
      externalBlocklistDomains,
      useExternalBlocklist,
      externalBlocklistSource,
      externalBlocklistUpdatedAt,
    } = await browser.storage.local.get({
      externalBlocklistDomains: [],
      useExternalBlocklist: false,
      externalBlocklistSource: '',
      externalBlocklistUpdatedAt: 0,
    })

    return {
      count: externalBlocklistDomains.length,
      enabled: useExternalBlocklist,
      source: externalBlocklistSource,
      updatedAt: externalBlocklistUpdatedAt,
    }
  }

  async setExternalBlocklistEnabled (value) {
    await browser.storage.local.set({ useExternalBlocklist: !!value })
  }

  async clearExternalBlocklist () {
    await browser.storage.local.set({
      externalBlocklistDomains: [],
      useExternalBlocklist: false,
      externalBlocklistSource: '',
      externalBlocklistUpdatedAt: 0,
    })
  }

  async add (url) {
    const domain = extractDomainFromUrl(url)
    const { customProxiedDomains } =
      await browser.storage.local.get({ customProxiedDomains: [] })

    if (!customProxiedDomains.includes(domain)) {
      customProxiedDomains.push(domain)
      await browser.storage.local.set({ customProxiedDomains })
      console.log(`${domain} added to the custom registry.`)
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
      console.log(`${domain} removed from custom registry`)
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
