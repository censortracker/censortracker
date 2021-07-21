import registry from './registry'
import storage from './storage'
import { extractHostnameFromUrl, startsWithHttpHttps } from './utilities'

const ipRangeCheck = require('ip-range-check')

class Ignore {
  constructor () {
    this.ignoredHosts = new Set()
    this.temporarilyIgnoredHosts = new Set()
    this.ignoreSyncIntervalMs = (60 * 30) * 1000
    this.specialPurposeIPs = [
      '0.0.0.0/8',
      '10.0.0.0/8',
      '100.64.0.0/10',
      '127.0.0.0/8',
      '169.254.0.0/16',
      '172.16.0.0/12',
      '192.168.0.0/16',
      '198.51.100.0/24',
      '203.0.113.0/24',
      '224.0.0.0/4',
      '240.0.0.0/4',
      '::/128',
      '::1/128',
      '::/96',
      '::ffff:/96',
      '2001:db8::/32',
      'fe80::/10',
      'fec0::/10',
      'fc00::/7',
      'ff00::/8',
    ]

    setInterval(async () => {
      await this.save()
    }, this.ignoreSyncIntervalMs)
  }

  isSpecialPurposeIP = (ip) => {
    try {
      return ipRangeCheck(ip, this.specialPurposeIPs)
    } catch (error) {
      return false
    }
  }

  setDefaultIgnoredHosts = async () => {
    if (await registry.isConfiguredForCountry({ code: 'RU' })) {
      // Don't proxy Google Services in Russia
      await storage.set({
        ignoredHosts: [
          'youtu.be',
          'youtube.com',
          'google.ru',
          'google.com',
        ],
      })
      console.warn('Ignored hosts set!')
    }
  }

  save = () => {
    storage.get({ ignoredHosts: [] })
      .then(({ ignoredHosts }) => {
        for (const hostname of ignoredHosts) {
          this.ignoredHosts.add(hostname)
        }
        console.log('All ignored domain saved!')
      })
  }

  add = async (url, { temporary = false } = {}) => {
    const hostname = extractHostnameFromUrl(url)

    if (temporary === true) {
      this.temporarilyIgnoredHosts.add(hostname)
    } else {
      const { ignoredHosts } = await storage.get({ ignoredHosts: [] })

      if (!ignoredHosts.includes(hostname)) {
        ignoredHosts.push(hostname)
      }

      for (const item of ignoredHosts) {
        this.ignoredHosts.add(item)
      }

      await storage.set({ ignoredHosts })
    }
  }

  contains = (url) => {
    const ignoreRegEx = /localhost/
    const hostname = extractHostnameFromUrl(url)
    const ignoredHosts = new Set([
      ...this.ignoredHosts,
      ...this.temporarilyIgnoredHosts,
    ])

    if (!startsWithHttpHttps(url)) {
      return true
    }

    if (ignoredHosts.has(hostname) || hostname.match(ignoreRegEx)) {
      console.warn(`Ignoring host: ${hostname}`)
      return true
    }
    return this.isSpecialPurposeIP(hostname)
  }
}

export default new Ignore()
