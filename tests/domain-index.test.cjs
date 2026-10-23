const assert = require('node:assert/strict')
const { test } = require('node:test')
const vm = require('node:vm')
const load = require('./load.cjs')
const { buildDomainIndex, createDomainIndex } = load('background/domain-index')
const { findHostMatch } = load('background/host-match')
const { getPacScript } = load('background/pac')

test('packed domains keep exact boundaries and parent rules without large PAC Sets', async () => {
  const names = ['example.co.uk', 'api.example.co.uk', 'ПРИМЕР.РФ', '8.8.8.8', null,
    ...Array.from({ length: 10000 }, (_, index) => `site${index}.example`)]
  const domains = await buildDomainIndex(names)
  const index = createDomainIndex(domains)
  assert.equal(findHostMatch('cdn.api.example.co.uk', index), 'api.example.co.uk')
  const scope = { Set: class extends Set {
    constructor(values) { super(values); assert.ok(this.size < 100, 'PAC built a large Set') }
  } }
  vm.runInNewContext(getPacScript({ domains }), scope)
  for (const host of ['cdn.api.example.co.uk', 'xn--e1afmkfd.xn--p1ai', '8.8.8.8',
    'site0.example', 'cdn.site9999.example']) {
    assert.ok(findHostMatch(host, index), host)
    assert.equal(scope.FindProxyForURL('', host), 'PROXY 127.0.0.1:0', host)
  }
  for (const host of ['badexample.co.uk', 'example.co.uk.evil', 'site10000.example', '88.8.8.8']) {
    assert.equal(findHostMatch(host, index), null, host)
    assert.equal(scope.FindProxyForURL('', host), 'DIRECT', host)
  }
})

test('obsolete domain builds stop at a yield', async () => {
  assert.equal(await buildDomainIndex(Array(10000).fill('example.com'), () => false), null)
})
