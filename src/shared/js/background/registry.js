import { getConfig, setConfig } from '../config'
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
    } = await getConfig(
      'domains',
      'useRegistry',
      'ignoredHosts',
      'customProxiedDomains',
    )

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

  /**
   * Divides domains by level. Assumably faster than using regular expressions
   */
  async getDomainsByLevel () {
    const domainsArray = await this.getDomains()
    const domainsDict = domainsArray.reduce((acc, item) => {
      const domainLevelKey = `blockedDomainsOfLevel${item.split('.').length}`

      if (!acc[domainLevelKey]) {
        acc[domainLevelKey] = []
      }
      acc[domainLevelKey].push(item)
      return acc
    }, {})

    for (const domainLevelKey of Object.keys(domainsDict)) {
      domainsDict[domainLevelKey].sort()
    }

    return domainsDict
  }

  async isEmpty () {
    const domains = await this.getDomains()

    return domains.length === 0
  }

  async add (url) {
    const domain = extractDomainFromUrl(url)
    const { customProxiedDomains } = await getConfig('customProxiedDomains')

    if (!customProxiedDomains.includes(domain)) {
      customProxiedDomains.push(domain)
      setConfig({ customProxiedDomains })
      console.warn(`${domain} added to the custom registry.`)
    }
    return true
  }

  async remove (url) {
    const domain = extractDomainFromUrl(url)
    const { customProxiedDomains } = await getConfig('customProxiedDomains')

    if (customProxiedDomains.includes(domain)) {
      const index = customProxiedDomains.indexOf(domain)

      customProxiedDomains.splice(index, 1)
      setConfig({ customProxiedDomains })
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
    } = await getConfig(
      'domains',
      'ignoredHosts',
      'customProxiedDomains',
    )

    if (ignoredHosts.includes(domain)) {
      return false
    }

    return !!(domains.includes(domain) ||
      customProxiedDomains.includes(domain))
  }

  /**
   * Checks if the given URL is in registry of IDO (Information Dissemination Organizer).
   * This method makes sense only for some countries (Russia).
   */
  async retrieveDisseminator (url) {
    const domain = extractDomainFromUrl(url)
    const { disseminators } = await getConfig('disseminators')

    const dataObject = disseminators.find(
      ({ url: innerUrl }) => domain === innerUrl,
    )

    if (dataObject) {
      return dataObject
    }
    return {}
  }

  async enableRegistry () {
    setConfig({ useRegistry: true })
  }

  async disableRegistry () {
    setConfig({ useRegistry: false })
  }

  async clearRegistry () {
    setConfig({ domains: [] })
  }
}

export default new Registry()
