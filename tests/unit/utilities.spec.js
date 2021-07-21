import {
  enforceHttpConnection,
  enforceHttpsConnection,
  extractHostnameFromUrl,
  isValidURL,
  wildcardDomainMatch,
} from '../../src/common/js/utilities'

describe('Validate URL', () => {
  test('returns true when URL is valid otherwise false', () => {
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
        expect(isValidURL(url)).toBeTruthy()
      } else {
        expect(isValidURL(url)).toBeFalsy()
      }
    }
  })
})

describe('Extract hostname from the URL', () => {
  test('returns cleaned URL (removes http/https, www)', () => {
    const urls = [
      { url: 'https://telegram.org', expected: 'telegram.org' },
      { url: 'http://www.example.org', expected: 'example.org' },
      { url: 'https://www.example.org', expected: 'example.org' },
      { url: 'https://roskomsvoboda.org', expected: 'roskomsvoboda.org' },
      { url: 'http://extranjeros.mitramiss.gob.es', expected: 'extranjeros.mitramiss.gob.es' },
      { url: 'http://192.168.2.1', expected: '192.168.2.1' },
      { url: 'https://192.168.2.1', expected: '192.168.2.1' },
      { url: 'https://www.192.168.2.1', expected: '192.168.2.1' },
      { url: 'http://www.192.168.2.1', expected: '192.168.2.1' },
    ]

    for (const { url, expected } of urls) {
      expect(extractHostnameFromUrl(url)).toEqual(expected)
    }
  })
})

describe('Check if URL is chrome extension', () => {
  test('returns true if url is chrome', () => {
    const urls = [
      { url: 'https://google.com', expected: true },
      { url: 'http://telegram.org', expected: true },
      { url: 'chrome-extension://bpmcpldpdmajfigpchkicefoigmkfalc/index.html', valid: false },
    ]

    for (const { url, expected } of urls) {
      if (expected) {
        expect(isValidURL(url)).toBeTruthy()
      } else {
        expect(isValidURL(url)).toBeFalsy()
      }
    }
  })
})

describe('Enforce HTTPS', () => {
  test('replaces http: with https:', () => {
    const urls = [
      { url: 'http://telegram.org/', expected: 'https://telegram.org/' },
      { url: 'http://google.com/', expected: 'https://google.com/' },
      { url: 'http://2ch.hk/', expected: 'https://2ch.hk/' },
      { url: 'http://2ch.hk/https/', expected: 'https://2ch.hk/https/' },
    ]

    for (const { url, expected } of urls) {
      expect(enforceHttpsConnection(url)).toEqual(expected)
    }
  })
})

describe('Enforce HTTP', () => {
  test('replaces https: with http:', () => {
    const urls = [
      { url: 'https://telegram.org/', expected: 'http://telegram.org/' },
      { url: 'https://google.com/', expected: 'http://google.com/' },
      { url: 'https://2ch.hk/', expected: 'http://2ch.hk/' },
      { url: 'https://2ch.hk/https/', expected: 'http://2ch.hk/https/' },
    ]

    for (const { url, expected } of urls) {
      expect(enforceHttpConnection(url)).toEqual(expected)
    }
  })
})

describe('Match domain by wildcard', () => {
  test('match by wildcard', () => {
    const inputData = [
      { pattern: 'google.*', domain: 'google.com', expected: true },
      { pattern: '*.google.*', domain: 'api.google.com', expected: true },
      { pattern: '*.google.*', domain: 'google.com', expected: false },
      { pattern: '*.google.com', domain: 'api.google.com', expected: true },
      { pattern: 'google.*', domain: 'api.google.com', expected: false },
      { pattern: '*.google.com', domain: 'google.com', expected: false },
    ]

    for (const { pattern, domain, expected } of inputData) {
      expect(wildcardDomainMatch({ pattern, domain })).toEqual(expected)
    }
  })
})
