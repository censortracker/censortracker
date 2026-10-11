import browser from './browser-api'
import type { DomainIndex } from './domain-index'
import { buildDomainIndex, createDomainIndex } from './domain-index'
import { findHostMatch } from './host-match'
import { externalRegistryDomains, registrySourceDefaults } from './registry-source-data'
import type { Disseminator } from './service-config'
import type { StorageState } from './storage'
import {
  extractDomainFromUrl,
  extractHostnameFromUrl,
} from './utilities'

let membership: Promise<(DomainIndex | null)[]> | null
let membershipIndexes: (DomainIndex | null)[] = []
const membershipDefaults = [
  { domains: [] },
  { registrySource: registrySourceDefaults, externalRegistry: null },
  { customProxiedDomains: [] },
  { ignoredHosts: [] },
]

if (browser.storage?.onChanged) {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') {
      return
    }
    const changed = membershipDefaults.map((defaults) =>
      Object.keys(defaults).some((key) => changes[key]))

    if (changed.some(Boolean)) {
      membership = null
      membershipIndexes = membershipIndexes.map((index, position) =>
        changed[position] ? null : index)
    }
  })
}

const loadMembership = async () => {
  const indexes = membershipIndexes
  const state = await browser.storage.local.get(Object.assign({},
    ...membershipDefaults.filter((defaults, position) => !indexes[position]))) as Pick<StorageState, 'domains' | 'registrySource' | 'externalRegistry' | 'customProxiedDomains' | 'ignoredHosts'>
  const lists = [state.domains, externalRegistryDomains(state),
    state.customProxiedDomains, state.ignoredHosts]
  const current = () => indexes === membershipIndexes

  for (const [position, names] of lists.entries()) {
    if (indexes[position]) {
      continue
    }
    const data = await buildDomainIndex(names, current)

    if (!data) {
      return indexes
    }
    indexes[position] = createDomainIndex(data) as DomainIndex
  }
  return indexes
}

const getMembership = async (): Promise<DomainIndex[]> => {
  const pending = membership || (membership = loadMembership())

  try {
    const indexes = await pending

    return membership === pending ? indexes as DomainIndex[] : getMembership()
  } catch (error) {
    if (membership === pending) {
      membership = null
    }
    throw error
  }
}

class Registry {
  /**
   * Returns array of banned domains from the registry.
   */

  async getDomains () {
    const {
      domains,
      useRegistry,
      customProxiedDomains,
      registrySource,
      externalRegistry,
    } = await browser.storage.local.get({
      domains: [],
      useRegistry: true,
      customProxiedDomains: [],
      registrySource: registrySourceDefaults,
      externalRegistry: null,
    })

    return [
      ...(useRegistry ? domains : []),
      ...customProxiedDomains,
      ...externalRegistryDomains({ registrySource, externalRegistry }),
    ]
  }

  async isEmpty () {
    return await this.getDomainCount() === 0
  }

  async getRoutingDomains () {
    const [builtin, external, custom] = await getMembership()
    const { useRegistry } =
      await browser.storage.local.get({ useRegistry: true })
    const indexes = [...(useRegistry ? [builtin] : []), external, custom]

    return {
      lists: indexes.flatMap((index) => index.data.lists),
      count: indexes.reduce((count, index) => count + index.data.count, 0),
    }
  }

  async getDomainCount () {
    return (await this.getRoutingDomains()).count
  }

  async getStatus () {
    const { registryStatus } =
      await browser.storage.local.get({ registryStatus: null })

    if (registryStatus) {
      return registryStatus
    }
    const [builtin] = await getMembership()

    return {
      state: builtin.data.count > 0 ? 'ready' : 'not_loaded', skipped: 0, error: '',
    }
  }

  async add (url: string) {
    const domain = extractHostnameFromUrl(url)
    const { customProxiedDomains } =
      await browser.storage.local.get({ customProxiedDomains: [] })

    if (!domain) {
      return false
    }
    if (!customProxiedDomains.includes(domain)) {
      customProxiedDomains.push(domain)
      await browser.storage.local.set({ customProxiedDomains })
      console.debug(`${domain} added to the custom registry.`)
    }
    return true
  }

  async remove (url: string) {
    const domain = extractHostnameFromUrl(url)
    const { customProxiedDomains } =
      await browser.storage.local.get({ customProxiedDomains: [] })

    const remaining = customProxiedDomains.filter((name) =>
      !findHostMatch(domain, new Set([extractHostnameFromUrl(name)])))

    await browser.storage.local.set({ customProxiedDomains: remaining })
    return true
  }

  /**
   * Checks if the given URL is in the registry of banned websites.
   */
  async contains (url: string) {
    const { blocked, custom, ignored } = await this.getDomainStatus(url)

    return !ignored && (blocked || custom)
  }

  /**
   * Returns list membership, independent of proxy settings.
   */
  async getDomainStatus (url: string) {
    const domain = extractHostnameFromUrl(url)
    const [builtin, external, custom, ignored] = await getMembership()
    const matches = (index: DomainIndex) => Boolean(findHostMatch(domain,
      index))

    return {
      blocked: matches(builtin) || matches(external),
      custom: matches(custom),
      ignored: matches(ignored),
    }
  }

  /**
   * Checks if the given URL is in registry of IDO (Information Dissemination Organizer).
   * This method makes sense only for some countries (Russia).
   */
  async retrieveDisseminator (url: string): Promise<Partial<Disseminator>> {
    const domain = extractDomainFromUrl(url)
    const { disseminators } =
      await browser.storage.local.get({ disseminators: [] })

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
