import shortcuts from '../../src/chrome/js/core/shortcuts'

describe('Validate URL', () => {
  test('it should return true when URL is valid otherwise false', () => {
    const urls = [
      { url: 'https://google.com', valid: true },
      { url: 'http://telegram.org', valid: true },
      { url: 'http://www.example.org', valid: true },
      { url: 'bbc.co.uk', valid: true },
      { url: 'http://bbc.co.uk', valid: true },
      { url: 'roskomsvoboda.org', valid: true },
      { url: 'http://roskomsvoboda.', valid: false },
      { url: 'roskomsvoboda.cc.cc.c.c.c.c.c.c', valid: false },
      { url: 'chrome-extension://bpmcpldpdmajfigpchkicefoigmkfalc/index.html', valid: false },
    ]

    for (const { url, valid } of urls) {
      if (valid) {
        expect(shortcuts.validURL(url)).toBeTruthy()
      } else {
        expect(shortcuts.validURL(url)).toBeFalsy()
      }
    }
  })
})

describe('Clean hostname', () => {
  test('it should return cleaned url (remove https, www)', () => {
    const urls = [
      { url: 'https://telegram.org', expected: 'telegram.org' },
      { url: 'http://www.example.org', expected: 'example.org' },
      { url: 'https://www.example.org', expected: 'example.org' },
      { url: 'https://roskomsvoboda.org', expected: 'roskomsvoboda.org' },
      { url: 'http://extranjeros.mitramiss.gob.es', expected: 'extranjeros.mitramiss.gob.es' },
    ]

    for (const { url, expected } of urls) {
      expect(shortcuts.cleanHostname(url)).toEqual(expected)
    }
  })
})

describe('Check if URL is chrome extension', () => {
  test('it should return true if url is chrome', () => {
    const urls = [
      { url: 'https://google.com', expected: true },
      { url: 'http://telegram.org', expected: true },
      { url: 'chrome-extension://bpmcpldpdmajfigpchkicefoigmkfalc/index.html', valid: false },
    ]

    for (const { url, expected } of urls) {
      if (expected) {
        expect(shortcuts.validURL(url)).toBeTruthy()
      } else {
        expect(shortcuts.validURL(url)).toBeFalsy()
      }
    }
  })
})

describe('Enforce HTTPS', () => {
  test('it should replace http: with https:', () => {
    const urls = [
      { url: 'http://telegram.org/', expected: 'https://telegram.org/' },
      { url: 'http://google.com/', expected: 'https://google.com/' },
      { url: 'http://2ch.hk/', expected: 'https://2ch.hk/' },
      { url: 'http://2ch.hk/https/', expected: 'https://2ch.hk/https/' },
    ]

    for (const { url, expected } of urls) {
      expect(shortcuts.enforceHttps(url)).toEqual(expected)
    }
  })
})

describe('Check if IP is from the subnet of special-purpose (RFC6890)', () => {
  test('it should return true if IP address is from special-propose subnets', () => {
    const ips = [
      '0.0.0.1',
      '169.254.0.0',
      '169.254.255.255',
      '192.168.0.0',
      '192.168.255.255',
      '0:0:0:0:0:0:0:1',
      'fe80:0:0:0:0:0:0:0',
      '2001:db8:ffff:ffff:ffff:ffff:ffff:ffff',
    ]

    for (const ip of ips) {
      expect(shortcuts.isSpecialPurposeIP(ip)).toBeTruthy()
    }
  })
})
