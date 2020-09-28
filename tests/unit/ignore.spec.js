import ignore from '../../src/chrome/js/core/ignore'

describe('Check if IP is from the subnet of special-purpose (RFC6890)', () => {
  test('returns true if IP address is from special-propose subnets', () => {
    const ips = [
      { ip: '0.0.0.1', special: true },
      { ip: '169.254.0.0', special: true },
      { ip: '169.254.255.255', special: true },
      { ip: '192.168.0.0', special: true },
      { ip: '192.168.0.1', special: true },
      { ip: '192.168.255.255', special: true },
      { ip: '0:0:0:0:0:0:0:1', special: true },
      { ip: 'fe80:0:0:0:0:0:0:0', special: true },
      { ip: '2001:db8:ffff:ffff:ffff:ffff:ffff:ffff', special: true },
      { ip: 'https://google.com/', special: false },
      { ip: '162.158.158.247', special: false },
    ]

    for (const { ip, special } of ips) {
      if (special) {
        expect(ignore.isSpecialPurposeIP(ip)).toBeTruthy()
      } else {
        expect(ignore.isSpecialPurposeIP(ip)).toBeFalsy()
      }
    }
  })
})

describe('Check if host is ignored one', () => {
  test('returns true if host is ignored', () => {
    const ips = [
      '0.0.0.1',
      '169.254.0.0',
      '169.254.255.255',
      '192.168.0.0',
      '192.168.255.255',
      '0:0:0:0:0:0:0:1',
      'fe80:0:0:0:0:0:0:0',
      '2001:db8:ffff:ffff:ffff:ffff:ffff:ffff',
      'https://photos.google.com',
      'https://google.com',
      'http://localhost:8000',
      '192.168.0.1',
    ]

    for (const ip of ips) {
      expect(ignore.isIgnoredHost(ip)).toBeTruthy()
    }
  })
})

describe('Check add to temporary ignore', () => {
  test('returns true if host found in temporary ignore', () => {
    const hostnames = [
      'example.com',
      'example.org',
      'makuha.ru',
      'github.com',
    ]

    for (const hostname of hostnames) {
      ignore.addHostToIgnore(hostname)
      expect(ignore.isIgnoredHost(hostname)).toBeTruthy()
    }
  })
})
