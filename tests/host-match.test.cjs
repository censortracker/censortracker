const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const vm = require('node:vm')
const { findHostMatch } = load('background/host-match')

test('match full names and label-boundary parents, including multi-label suffixes', () => {
  const rules = new Set(['example.co.uk', 'example.com.br', 'api.example.com', '1.1.1.1'])
  for (const name of ['example.co.uk', 'a.b.example.co.uk', 'EXAMPLE.COM.BR.', 'a.api.example.com']) {
    assert.ok(findHostMatch(name, rules), name)
  }
  for (const name of ['other.co.uk', 'other.com.br', 'badexample.co.uk', 'api.example.com.evil',
    'example.com', 'www.example.com', '2.1.1.1', null]) {
    assert.equal(findHostMatch(name, rules), null, name)
  }
  assert.equal(findHostMatch('1.1.1.1', rules), '1.1.1.1')
  assert.equal(findHostMatch('8.8.8.8', new Set(['8.8'])), null)
  assert.equal(findHostMatch('a.api.example.com', new Set(['example.com', 'api.example.com'])), 'api.example.com')
  assert.equal(findHostMatch('unrelated.com', new Set(['com'])), null)
  assert.equal(findHostMatch('example.co.uk', new Set(['uk'])), null)
  assert.equal(findHostMatch('printer', new Set(['printer'])), 'printer')
})

test('PAC and registry preserve subdomains and multi-label suffixes', async () => {
  const domains = ['example.co.uk', 'example.com.br', 'api.example.com', 'com', 'uk']
  const storage = { domains, customProxiedDomains: [], ignoredHosts: [] }
  let changed = () => {}
  const browser = { storage: { local: {
    get: async () => storage,
    set: async values => { Object.assign(storage, values); changed(values, 'local') },
  }, onChanged: { addListener: listener => { changed = listener } } } }
  const loaded = load('background/registry', { 'browser-api': { default: browser } })
  loaded.watchRegistry()
  const registry = loaded.default
  const { getPacScript } = load('background/pac')
  const context = {}
  vm.runInNewContext(getPacScript({ domains, proxies: [{ protocol: 'HTTPS', host: 'proxy.example', port: 443 }] }), context)
  for (const host of ['a.b.example.co.uk', 'example.com.br', 'a.api.example.com']) {
    assert.match(context.FindProxyForURL('', host), /^HTTPS/)
    assert.equal((await registry.getDomainStatus(host)).blocked, true)
  }
  for (const host of ['other.co.uk', 'other.com.br', 'example.com', 'www.example.com']) {
    assert.equal(context.FindProxyForURL('', host), 'DIRECT')
    assert.equal((await registry.getDomainStatus(host)).blocked, false)
  }
  await registry.add('https://cdn.site.co.uk/resource')
  assert.equal((await registry.getDomainStatus('cdn.site.co.uk')).custom, true)
  assert.deepEqual(Array.from(storage.customProxiedDomains), ['cdn.site.co.uk'])
  assert.equal(await registry.add('about:blank'), false)
  await registry.remove('https://cdn.site.co.uk')
  assert.equal(storage.customProxiedDomains.length, 0)
  storage.customProxiedDomains = ['site.co.uk', 'api.site.co.uk', 'other.example']
  await registry.remove('https://a.api.site.co.uk')
  assert.deepEqual(Array.from(storage.customProxiedDomains), ['other.example'])
  assert.equal((await registry.getDomainStatus('a.api.site.co.uk')).custom, false)
  const { removeDuplicates } = load('background/hostname')
  assert.deepEqual(Array.from(removeDuplicates([' api.example.com ', 'https://api.example.com/x', 'example.com'])),
    ['api.example.com', 'example.com'])
})
