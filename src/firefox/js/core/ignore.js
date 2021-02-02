import storage from './storage'
import { extractHostnameFromUrl } from './utilities'

const ipRangeCheck = require('ip-range-check')

const SPECIAL_PURPOSE_IPS = [
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

class Ignore {
  constructor () {
    this.ignoredHosts = new Set()
  }

  isSpecialPurposeIP = (ip) => {
    try {
      return ipRangeCheck(ip, SPECIAL_PURPOSE_IPS)
    } catch (error) {
      return false
    }
  }

  save = async () => {
    const { ignoredHosts } =
      await storage.get({ ignoredHosts: [] })

    this.ignoredHosts.forEach((element) => {
      if (!ignoredHosts.includes(element)) {
        ignoredHosts.push(element)
      }
    })

    await storage.set({ ignoredHosts })
  }

  add = async (hostname) => {
    if (this.ignoredHosts.size > 100) {
      this.ignoredHosts.clear()
    }
    this.ignoredHosts.add(extractHostnameFromUrl(hostname))

    await this.save()
  }

  contains = (host) => {
    const ignoreRegEx = /(google.com|localhost)/

    host = extractHostnameFromUrl(host)

    if (this.ignoredHosts.has(host) || host.match(ignoreRegEx)) {
      return true
    }

    console.warn(`Ignoring host: ${host}`)

    return this.isSpecialPurposeIP(host)
  }
}

export default new Ignore()
