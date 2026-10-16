const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const { storageFixture } = require('./storage-fixture.cjs')
const vm = require('node:vm')

test('exclusions preserve hostnames and IPs and remove inherited rules', async () => {
  const { browser, data: storage } = storageFixture({ ignoredHosts: [] })
  const ignore = load('background/ignore', { 'browser-api': { default: browser } }).default
  await ignore.add('https://api.example.co.uk/path')
  await ignore.add('8.8.8.8')
  assert.equal(await ignore.add('about:blank'), false)
  assert.deepEqual(Array.from(storage.ignoredHosts), ['api.example.co.uk', '8.8.8.8'])
  assert.equal(await ignore.contains('a.api.example.co.uk'), true)
  assert.equal(await ignore.contains('example.co.uk'), false)
  assert.equal(await ignore.contains('badapi.example.co.uk'), false)
  assert.equal(await ignore.contains('8.8.8.8'), true)
  await ignore.set(['example.co.uk', 'api.example.co.uk', 'other.example'])
  await ignore.remove('https://a.api.example.co.uk')
  assert.deepEqual(Array.from(storage.ignoredHosts), ['other.example'])
})

for (const useRegistry of [true, false]) {
  test(`exclusions override parent and child proxy rules with registry=${useRegistry}`, async () => {
    const { browser, data: storage } = storageFixture({ useRegistry, domains: ['example.com', 'api.other.com', '8.8.8.8'],
      customProxiedDomains: ['example.com', 'api.other.com', '8.8.8.8'],
      ignoredHosts: ['api.example.com', 'other.com', '8.8.8.8'] })
    const registry = load('background/registry', { 'browser-api': { default: browser } }).default
    const { getPacScript } = load('background/pac')
    const context = {}
    vm.runInNewContext(getPacScript({ domains: await registry.getRoutingDomains(), ignoredHosts: storage.ignoredHosts,
      proxies: [{ protocol: 'HTTPS', host: 'proxy.example', port: 443 }] }), context)
    for (const host of ['api.example.com', 'child.api.example.com', 'api.other.com', '8.8.8.8']) {
      assert.equal((await registry.getDomainStatus(host)).ignored, true)
      assert.equal(context.FindProxyForURL('', host), 'DIRECT', host)
    }
    for (const host of ['example.com', 'www.example.com', 'badapi.example.com']) {
      assert.match(context.FindProxyForURL('', host), /^HTTPS/)
    }
  })
}
