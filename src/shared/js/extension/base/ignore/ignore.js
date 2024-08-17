import { extractDomainFromUrl } from '../../../utilities'
import configManager from '../config'

/**
 * Clears the list of ignored domains.
 * @returns {Promise<undefined>}
 */
export const clear = async () => {
  configManager.set({ ignoredHosts: [] })
}

/**
 * Returns the list of all ignored domains.
 * @returns {Promise<string[]>}
 */
export const getAll = async () => {
  const { ignoredHosts } = await configManager.get('ignoredHosts')

  return ignoredHosts
}

/**
 * Adds a given URL to the list of ignored.
 * @param url URL to ignore.
 * @returns {Promise<boolean>}
 */
export const add = async (url) => {
  const hostname = extractDomainFromUrl(url)
  const { ignoredHosts } = await configManager.get('ignoredHosts')

  if (!ignoredHosts.includes(hostname)) {
    ignoredHosts.push(hostname)
    console.warn(`Adding ${hostname} to ignore`)
    configManager.set({ ignoredHosts })
  }
  return true
}

export const set = async (ignoredHosts = []) => {
  configManager.set({ ignoredHosts })
}

/**
 * Removes a URL/Hostname from the list of ignored.
 * @param url URL to remove.
 * @returns {Promise<boolean>}
 */
export const remove = async (url) => {
  const hostname = extractDomainFromUrl(url)
  const { ignoredHosts } = await configManager.get('ignoredHosts')

  if (ignoredHosts.includes(hostname)) {
    const index = ignoredHosts.indexOf(hostname)

    ignoredHosts.splice(index, 1)
    configManager.set({ ignoredHosts })
    console.warn(`Removing ${hostname} from ignore`)
  }
  return true
}

/**
 * Checks if a given URL is ignored..
 * @param url URL.
 * @returns {Promise<boolean>}
 */
export const contains = async (url) => {
  const ignoredHosts = await getAll()
  const hostname = extractDomainFromUrl(url)

  if (ignoredHosts.includes(hostname)) {
    console.warn(`Ignoring host: ${hostname}`)
    return true
  }
  return false
}
