const ipRangeCheck = require('ip-range-check')

class Shortcuts {
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

  isSpecialPurposeHost = (host) => {
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

    host = this.cleanHostname(host)
    if (host.indexOf('localhost') !== -1) {
      return true
    }
    return ipRangeCheck(host, specialIPs)
  }
}

export default new Shortcuts()
