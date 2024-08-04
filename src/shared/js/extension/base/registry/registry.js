import { binaryContains, extractDomainFromUrl, extractHostnameFromUrl, removePrefix } from '../../../utilities'
import configManager from '../config'

export const enable = async () => {
  configManager.set({ useRegistry: true })
}

export const disable = async () => {
  configManager.set({ useRegistry: false })
}

/**
 * Returns array of banned domains from the registry.
 */
export const getDomains = async () => {
  const {
    domains,
    useRegistry,
    ignoredHosts,
    customProxiedDomains,
    customDPIDomains,
  } = await configManager.get(
    'domains',
    'useRegistry',
    'ignoredHosts',
    'customProxiedDomains',
    'customDPIDomains',
  )

  if (!useRegistry) {
    if (customProxiedDomains.length > 0) {
      return customProxiedDomains
    }
    return []
  }

  const allDomains = [
    ...domains,
    ...customDPIDomains,
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
export const getDomainsByLevel = async () => {
  const domainsArray = await getDomains()
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

export const isEmpty = async () => {
  const domains = await getDomains()

  return domains.length === 0
}

export const add = async (url) => {
  const domain = extractDomainFromUrl(url)
  const { customProxiedDomains } =
    await configManager.get('customProxiedDomains')

  if (!customProxiedDomains.includes(domain)) {
    customProxiedDomains.push(domain)
    configManager.set({ customProxiedDomains })
    console.warn(`${domain} added to the custom registry.`)
  }
  return true
}

export const remove = async (url) => {
  const domain = extractDomainFromUrl(url)
  const { customProxiedDomains } =
    await configManager.get('customProxiedDomains')

  if (customProxiedDomains.includes(domain)) {
    const index = customProxiedDomains.indexOf(domain)

    customProxiedDomains.splice(index, 1)
    configManager.set({ customProxiedDomains })
    console.warn(`${domain} removed from custom registry`)
  }
  return true
}

/**
 * Checks if the given URL is in the registry of banned websites.
 */
export const contains = async (url) => {
  if (!url) {
    return false
  }
  const domain = extractHostnameFromUrl(url)
  let searchString = domain

  const { ignoredHosts } = await configManager.get('ignoredHosts')
  const proxiedDomains = await getDomainsByLevel()

  if (ignoredHosts.includes(domain)) {
    return false
  }
  const domainLevel = domain.split('.').length

  // eslint-disable-next-line id-match
  for (let i = domainLevel; i > 1; i--) {
    if (i !== domainLevel) {
      searchString = searchString.substring(searchString.indexOf('.') + 1)
    }
    if (binaryContains(proxiedDomains[`blockedDomainsOfLevel${i}`], searchString)) {
      return true
    }
  }
  return false
}

/**
 * Checks if the given URL is in registry of IDO (Information Dissemination Organizer).
 * This method makes sense only for some countries (Russia).
 */
export const retrieveDisseminator = async (url) => {
  const domain = removePrefix(
    extractHostnameFromUrl(url),
    'www.',
  )

  const { disseminators } = await configManager.get('disseminators')

  const dataObject = disseminators.find(
    ({ url: innerUrl }) => domain === removePrefix(innerUrl, 'www.'),
  )

  return dataObject ?? {}
}

export const clear = async () => {
  configManager.set({ domains: [] })
}
