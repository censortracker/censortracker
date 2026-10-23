const assert = require('node:assert/strict')
const { test } = require('node:test')
const vm = require('node:vm')
const load = require('./load.cjs')
const { parseProxyAddress, proxyDirective } = load('background/proxy-address')
const { getPacScript } = load('background/pac')

test('proxy endpoints require a valid host, explicit port, and known protocol', () => {
  for (const address of ['proxy.example:443', '127.0.0.1:80', '[2001:db8::1]:1080']) {
    assert.ok(parseProxyAddress(address).port)
  }
  assert.equal(proxyDirective('HTTP', 'Proxy.Example.:080'), 'PROXY proxy.example:80')
  for (const address of ['', 'host', 'host:0', 'host:65536', 'a:1.5', 'host:1/path',
    'host:1; DIRECT', "host:1'; alert(1);'", 'user:pass@host:1', 'a\\b:1', 'a\nb:1',
    'a%0ab:1', 'a%2eb:1', 'http://host:80', '-host:1', '[::g]:1', 'host:1?x']) {
    assert.throws(() => parseProxyAddress(address), address)
  }
  assert.throws(() => proxyDirective('constructor', 'host:1'))
  assert.throws(() => proxyDirective('HTTPS; DIRECT', 'host:1'))
})

test('generated PAC serializes data and cannot execute imported proxy text', () => {
  const context = { shExpMatch: () => false }
  vm.runInNewContext(getPacScript({ domains: ['example.com'],
    proxies: [{ protocol: 'HTTP', host: 'proxy.example', port: 8080 }] }), context)
  assert.equal(context.FindProxyForURL('https://example.com', 'example.com'), 'PROXY proxy.example:8080;')
  assert.throws(() => getPacScript({ proxies: [{ protocol: 'HTTPS', host: "x:1'; globalThis.injected = true; '", port: 80 }] }))
  assert.equal(context.injected, undefined)
})
