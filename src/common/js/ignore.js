import axios from 'axios'

import storage from './storage'
import { extractHostnameFromUrl } from './utilities'

const IGNORE_SAVE_INTERVAL = (60 * 30) * 1000
const IGNORE_FETCH_INTERVAL = (60 * 15) * 1000
const IGNORE_API_ENDPOINT_URI = 'https://app.censortracker.org/api/ignore/'

class Ignore {
  constructor () {
    this._ignoredHosts = new Set()

    setInterval(async () => {
      await this.fetch()
    }, IGNORE_FETCH_INTERVAL)

    setInterval(async () => {
      await this.save()
    }, IGNORE_SAVE_INTERVAL)
  }

  fetch = async () => {
    try {
      const { data: domains } = await axios.get(IGNORE_API_ENDPOINT_URI)
      const { ignoredHosts } = await storage.get({ ignoredHosts: [] })

      for (const domain of domains) {
        if (!ignoredHosts.includes(domain)) {
          ignoredHosts.push(domain)
        }
      }
      await storage.set({ ignoredHosts })
    } catch (error) {
      console.warn('Fetching ignored domains...')
    }
  }

  save = async () => {
    const { ignoredHosts } = await storage.get({ ignoredHosts: [] })

    for (const hostname of ignoredHosts) {
      this._ignoredHosts.add(hostname)
      console.log('All ignored domain saved!')
    }
  }

  clear = async () => {
    this._ignoredHosts.clear()
    await storage.set({ ignoredHosts: [] })
  }

  add = async (url) => {
    const hostname = extractHostnameFromUrl(url)

    console.warn(`Added to ignore: ${url}`)

    const { ignoredHosts } = await storage.get({ ignoredHosts: [] })

    if (!ignoredHosts.includes(hostname)) {
      ignoredHosts.push(hostname)
      console.warn(`Adding ${hostname} to ignore`)
    }

    for (const item of ignoredHosts) {
      this._ignoredHosts.add(item)
    }

    await storage.set({ ignoredHosts })
  }

  contains = (url) => {
    const hostname = extractHostnameFromUrl(url)

    if (this._ignoredHosts.has(hostname)) {
      console.warn(`Ignoring host: ${hostname}`)
      return true
    }
    return false
  }
}

export default new Ignore()
