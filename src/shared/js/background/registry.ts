import browser from './browser-api'
import type { DomainIndex } from './domain-index'
import { buildDomainIndex, createDomainIndex } from './domain-index'
import { findHostMatch } from './host-match'
import { indexCache, registryWrites } from './index-cache'
import { externalRegistryDomains, registrySourceDefaults } from './registry-source-data'
import type { Disseminator } from './service-config'
import {
  extractDomainFromUrl,
  extractHostnameFromUrl,
} from './utilities'

// Built-in registry, external registry, custom domains and exclusions.
type Membership = [DomainIndex, DomainIndex, DomainIndex, DomainIndex]
let membership: Promise<(DomainIndex | null)[]> | null
let membershipIndexes: (DomainIndex | null)[] = []
const membershipKeys = [
  ['domains', 'domainsRevision'],
  ['registrySource', 'externalRegistry', 'externalRegistryRevision'],
  ['customProxiedDomains'],
  ['ignoredHosts'],
]

const invalidateMembership = (keys: string[]) => {
  const changed = membershipKeys.map((names) =>
    names.some((key) => keys.includes(key)))

  if (changed.some(Boolean)) {
    membership = null
    membershipIndexes = membershipIndexes.map((index, position) =>
      changed[position] ? null : index)
  }
}

export const watchRegistry = () => {
  registryWrites.add(invalidateMembership)
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      invalidateMembership(Object.keys(changes))
    }
  })
}

const loadMembership = async () => {
  const indexes = membershipIndexes
  const current = () => indexes === membershipIndexes
  const revisions: string[] = []

  if (typeof indexedDB !== 'undefined' && (!indexes[0] || !indexes[1])) {
    const { domainsRevision, externalRegistryRevision, registrySource } =
      await browser.storage.local.get({
        domainsRevision: '',
        externalRegistryRevision: '',
        registrySource: registrySourceDefaults,
      })

    revisions.push(domainsRevision, externalRegistryRevision &&
      JSON.stringify([externalRegistryRevision, registrySource]))
    await Promise.all(revisions.map(async (revision, position) => {
      if (!indexes[position] && revision) {
        const data = await indexCache(String(position), revision)

        if (data && current()) {
          indexes[position] = createDomainIndex(data)
        }
      }
    }))
  }
  if (!current()) {
    return indexes
  }
  const state = await browser.storage.local.get({
    ...indexes[0] ? {} : { domains: [] },
    ...indexes[1] ? {} : {
      registrySource: registrySourceDefaults, externalRegistry: null,
    },
    ...indexes[2] ? {} : { customProxiedDomains: [] },
    ...indexes[3] ? {} : { ignoredHosts: [] },
  })
  const lists = [state.domains, externalRegistryDomains(state),
    state.customProxiedDomains, state.ignoredHosts]

  for (const [position, names] of lists.entries()) {
    if (indexes[position]) {
      continue
    }
    const data = await buildDomainIndex(names || [], current)
    const revision = revisions[position]

    if (!data) {
      return indexes
    }
    indexes[position] = createDomainIndex(data)
    if (revision) {
      // Do not delay routing while the optional snapshot is saved.
      indexCache(String(position), revision, data).catch(() => null)
    }
  }
  return indexes
}

const complete = ([builtin, external, custom, ignored]: (DomainIndex | null)[]):
  Membership | null => builtin && external && custom && ignored
  ? [builtin, external, custom, ignored] : null

const getMembership = async (): Promise<Membership> => {
  const pending = membership || (membership = loadMembership())

  try {
    const indexes = complete(await pending)

    // A superseded load can return before every list is indexed.
    return membership === pending && indexes ? indexes : getMembership()
  } catch (error) {
    if (membership === pending) {
      membership = null
    }
    throw error
  }
}

class Registry {
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
}

export default new Registry()
