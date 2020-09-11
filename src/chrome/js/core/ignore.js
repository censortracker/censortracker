import asynchrome from './asynchrome'

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

  saveIgnoredHosts = async () => {
    const { ignoredHosts } =
      await asynchrome.storage.local.get({ ignoredHosts: [] })

    this.ignoredHosts.forEach((element) => {
      if (!ignoredHosts.includes(element)) {
        ignoredHosts.push(element)
      }
    })

    await asynchrome.storage.local.set({ ignoredHosts })
  }

  addHostToIgnore = async (hostname) => {
    if (this.ignoredHosts.size > 100) {
      this.ignoredHosts.clear()
    }
    this.ignoredHosts.add(this.cleanHostname(hostname))

    await this.saveIgnoredHosts()
  }

  isIgnoredHost = (host) => {
    const ignoreRegEx = /(google.com|localhost)/

    host = this.cleanHostname(host)

    if (this.ignoredHosts.has(host) || host.match(ignoreRegEx)) {
      return true
    }

    return this.isSpecialPurposeIP(host)
  }
}

export default new Ignore()
