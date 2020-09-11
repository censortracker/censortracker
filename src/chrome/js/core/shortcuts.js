const ipRangeCheck = require('ip-range-check')

class Shortcuts {
  constructor () {
    this._ignoredHosts = new Set()
  }

  validURL = (urlStr) => {
    const pattern = new RegExp(
      '^(https?:\\/\\/)?' +
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' +
      '((\\d{1,3}\\.){3}\\d{1,3}))' +
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' +
      '(\\?[;&a-z\\d%_.~+=-]*)?' +
      '(\\#[-a-z\\d_]*)?$',
      'i',
    )

    if (this.isChromeExtensionUrl(urlStr)) {
      return false
    }

    return !!pattern.test(urlStr)
  }

  cleanHostname = (hostname) => {
    hostname = hostname.replace(/^(?:https?:\/\/)?(?:www\.)?/i, '').trim()

    if (hostname.indexOf('/') !== -1) {
      hostname = hostname.split('/')[0].trim()
    }
    return hostname
  }

  isChromeExtensionUrl = (url) => {
    return url.startsWith('chrome-extension://')
  }

  enforceHttps = (hostname) => {
    return hostname.replace(/^http:/, 'https:')
  }

  isSpecialPurposeIP = (ip) => {
    const specialIPs = [
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

    try {
      return ipRangeCheck(ip, specialIPs)
    } catch (error) {
      return false
    }
  }

  addToTemporaryIgnore = (hostname) => {
    if (this._ignoredHosts.size > 100) {
      this._ignoredHosts.clear()
    }
    this._ignoredHosts.add(this.cleanHostname(hostname))
  }

  isIgnoredHost = (host) => {
    host = this.cleanHostname(host)

    if (this._ignoredHosts.has(host)) {
      return true
    }

    if (host.indexOf('google.com') !== -1) {
      return true
    }

    if (host.indexOf('localhost') !== -1) {
      return true
    }
    return this.isSpecialPurposeIP(host)
  }
}

export default new Shortcuts()
