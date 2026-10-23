const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const { validateSiteRules, changeSiteRule, hasSiteRestriction } = load('background/site-rules')
const { validateSettings } = load('background/settings-data')
const { proxyFingerprint } = load('background/proxy-check-data')
const plain = value => JSON.parse(JSON.stringify(value))

test('site rules validate backups, retain full hostnames, and normalize IDNs', () => {
  const rules = { 'shop.example.co.uk': ['RU', 'CN', 'RU'], 'ПРИМЕР.РФ': ['US'] }
  assert.deepEqual(plain(validateSiteRules(rules)), {
    'shop.example.co.uk': ['RU', 'CN'], 'xn--e1afmkfd.xn--p1ai': ['US'],
  })
  assert.deepEqual(plain(validateSettings({ siteCountryRules: rules }).siteCountryRules), plain(validateSiteRules(rules)))
  for (const value of [null, [], { 'bad host': ['RU'] }, { 'example.com': 'RU' }, { 'example.com': ['ru'] },
    { 'example.com': ['XX'] }, JSON.parse('{"__proto__":["RU"]}'),
    Object.fromEntries(Array.from({ length: 1001 }, (_, i) => [`${i}.example.com`, ['RU']]))]) {
    assert.throws(() => validateSettings({ siteCountryRules: value }))
  }
})

test('site rules support explicit child overrides and deletion without modifying parents', () => {
  const original = { 'example.com': ['RU'], 'api.example.com': [] }
  assert.equal(hasSiteRestriction('cdn.example.com', original), true)
  assert.equal(hasSiteRestriction('cdn.api.example.com', original), false)
  assert.equal(hasSiteRestriction('notexample.com', original), false)
  const changed = changeSiteRule(original, { host: 'api.example.com', countries: ['CN'] })
  assert.deepEqual(plain(changed['api.example.com']), ['CN'])
  assert.deepEqual(original['api.example.com'], [])
  const removed = changeSiteRule(changed, { host: 'api.example.com', countries: null })
  assert.equal(hasSiteRestriction('cdn.api.example.com', removed), true)
})

test('routing metadata uses only matching exit checks, not server location or stale credentials', async () => {
  const proxy = { id: 'one', protocol: 'HTTP', host: 'proxy.example', port: 80 }
  const storage = { proxies: [proxy], selectedProxyIds: ['one'], proxyChecks: {
    one: { status: 'ok', fingerprint: await proxyFingerprint(proxy), serverCountry: 'RU', exitCountry: 'US', checkedAt: Date.now() },
  } }
  const manager = load('background/proxy', {
    'browser-api': { default: { storage: { local: { get: async defaults => ({ ...defaults, ...storage }) } } } },
    'proxy-route': {}, registry: { default: {} },
  }).default
  assert.equal((await manager.getSelectedProxies())[0].exitCountry, 'US')
  delete storage.proxyChecks.one.exitCountry
  assert.equal((await manager.getSelectedProxies())[0].exitCountry, '')
  storage.proxyChecks.one.exitCountry = 'US'
  proxy.password = 'changed'
  assert.equal((await manager.getSelectedProxies())[0].exitCountry, '')
})
