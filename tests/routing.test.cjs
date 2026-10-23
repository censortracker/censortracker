const assert = require('node:assert/strict')
const { test } = require('node:test')
const vm = require('node:vm')
const load = require('./load.cjs')
const { getPacScript } = load('background/pac')
const { createRouter, routingConfig } = load('background/routing')
const { findHostMatch } = load('background/host-match')
const { isPrivateHost } = load('background/private-host')

test('site-country rules have identical PAC and runtime decisions and fail closed on unknown exits', () => {
  const options = { domains: ['example.co.uk', 'example.com.br'], ignoredHosts: ['ignored.example.co.uk'],
    siteCountryRules: { 'example.co.uk': ['RU'], 'api.example.co.uk': ['US'],
      'free.api.example.co.uk': [], 'example.com.br': ['US', 'RU'] },
    proxies: [
      { id: 'ru', protocol: 'HTTP', host: 'ru.example', port: 80, exitCountry: 'RU', countryExpiresAt: Date.now() + 10000 },
      { id: 'us', protocol: 'HTTPS', host: 'us.example', port: 443, exitCountry: 'US', countryExpiresAt: Date.now() + 10000 },
      { id: 'unknown', protocol: 'SOCKS5', host: 'unknown.example', port: 1080 },
    ],
  }
  const router = createRouter(routingConfig(options), findHostMatch, isPrivateHost)
  const context = {}
  vm.runInNewContext(getPacScript(options), context)
  for (const [host, expected] of [['example.co.uk', ['us']], ['cdn.example.co.uk', ['us']],
    ['api.example.co.uk', ['ru']], ['child.api.example.co.uk', ['ru']],
    ['example.com.br', []], ['ignored.example.co.uk', []], ['other.example', []]]) {
    assert.deepEqual(Array.from(router(host).proxies), expected, host)
    assert.equal(context.FindProxyForURL('', host), router(host).route, host)
  }
  assert.equal(router('free.api.example.co.uk').proxies.length, 3)
  assert.equal(router('example.com.br').type, 'blocked')
  assert.equal(router('ignored.example.co.uk').type, 'direct')
  vm.runInNewContext(getPacScript({ ...options, proxies: [options.proxies[2]], proxyAll: true }), context)
  assert.equal(context.FindProxyForURL('', 'example.co.uk'), 'PROXY 127.0.0.1:0')
})

test('country metadata expires inside the PAC and probes cannot bypass a site restriction', () => {
  let now = 1000
  const scope = { Date: { now: () => now } }
  const proxy = { id: 'one', protocol: 'HTTP', host: 'proxy.example', port: 80,
    exitCountry: 'US', countryExpiresAt: 2000 }
  const options = { proxyAll: true, proxies: [proxy], siteCountryRules: { 'protected.example': ['RU'], 'echo.example': ['CN'] },
    probes: [{ hostname: 'echo.example', proxy, expiresAt: 9000 }] }
  vm.runInNewContext(getPacScript(options), scope)
  assert.equal(scope.FindProxyForURL('', 'protected.example'), 'PROXY proxy.example:80;')
  assert.equal(scope.FindProxyForURL('', 'echo.example'), 'PROXY 127.0.0.1:0')
  now = 2000
  assert.equal(scope.FindProxyForURL('', 'protected.example'), 'PROXY 127.0.0.1:0')
  assert.equal(scope.FindProxyForURL('', 'other.example'), 'PROXY proxy.example:80;')
})

test('failed proxies stay selected but are bypassed until their cooldown expires', () => {
  let now = 1000
  const scope = { Date: { now: () => now } }
  const proxies = [
    { id: 'failed', protocol: 'HTTP', host: 'failed.example', port: 80, retryAt: 2000 },
    { id: 'healthy', protocol: 'HTTPS', host: 'healthy.example', port: 443 },
  ]
  vm.runInNewContext(getPacScript({ domains: ['protected.example'], proxies }), scope)
  assert.equal(scope.FindProxyForURL('', 'protected.example'), 'HTTPS healthy.example:443;')
  now = 2000
  assert.match(scope.FindProxyForURL('', 'protected.example'), /PROXY failed.example:80/)
  vm.runInNewContext(getPacScript({ domains: ['protected.example'], proxies: [proxies[0]] }), scope)
  now = 1000
  assert.equal(scope.FindProxyForURL('', 'protected.example'), 'PROXY 127.0.0.1:0')
  assert.equal(scope.FindProxyForURL('', 'public.example'), 'DIRECT')
})

test('probe routes are isolated, fail closed on expiry, and respect local and explicit exclusions', () => {
  const proxy = { id: 'probe', protocol: 'HTTP', host: 'check.example', port: 80, username: 'secret' }
  const options = { domains: ['protected.example'], ignoredHosts: ['ignored.example'],
    proxies: [{ id: 'normal', protocol: 'HTTPS', host: 'normal.example', port: 443 }],
    probes: ['echo.example', 'expired.example', 'ignored.example', '127.0.0.1'].map(hostname => ({
      hostname, proxy, expiresAt: hostname === 'expired.example' ? 1 : Date.now() + 10000,
    })),
  }
  const script = getPacScript(options)
  const scope = {}
  vm.runInNewContext(script, scope)
  assert.equal(scope.FindProxyForURL('', 'echo.example'), 'PROXY check.example:80')
  assert.equal(scope.FindProxyForURL('', 'expired.example'), 'PROXY 127.0.0.1:0')
  assert.equal(scope.FindProxyForURL('', 'protected.example'), 'HTTPS normal.example:443;')
  for (const host of ['ignored.example', '127.0.0.1', 'other.example']) assert.equal(scope.FindProxyForURL('', host), 'DIRECT')
  assert.doesNotMatch(script, /secret/)
})

test('sites have stable first proxies and all selected failover candidates', () => {
  const options = { domains: Array.from({ length: 100 }, (_, index) => `site${index}.co.uk`), proxies: [
    { id: 'one', protocol: 'HTTP', host: 'one.example', port: 80 },
    { id: 'two', protocol: 'HTTPS', host: 'two.example', port: 443 },
    { id: 'three', protocol: 'SOCKS5', host: 'three.example', port: 1080 },
  ] }
  const router = createRouter(routingConfig(options), findHostMatch, isPrivateHost)
  const context = {}
  vm.runInNewContext(getPacScript(options), context)
  const first = new Set()
  for (let index = 0; index < 100; index++) {
    const host = `site${index}.co.uk`
    const result = router(host)
    first.add(result.proxies[0])
    assert.equal(result.type, 'proxy')
    assert.equal(new Set(result.proxies).size, 3)
    assert.equal(context.FindProxyForURL('', host.toUpperCase() + '.'), result.route)
    assert.doesNotMatch(result.route, /DIRECT/)
    for (const prefix of ['www.', 'api.', 'nested.cdn.']) {
      assert.equal(router(prefix + host).route, result.route)
      assert.equal(context.FindProxyForURL('', prefix + host), result.route)
    }
  }
  assert.equal(first.size, 3)
  assert.equal(router('other.example').type, 'direct')
})

test('provider and nested registry entries keep their subdomains on one route', () => {
  const options = { domains: ['example.com.br', 'nested.example.com.br'],
    providerDomains: ['provider.co.uk'], proxies: [
      { id: 'one', protocol: 'HTTP', host: 'one.example', port: 80 },
      { id: 'two', protocol: 'HTTPS', host: 'two.example', port: 443 },
      { id: 'provider', protocol: 'HTTPS', host: 'provider.example', port: 443, provider: 'antizapret' },
    ] }
  for (const proxyAll of [false, true]) {
    const scope = {}
    vm.runInNewContext(getPacScript({ ...options, proxyAll }), scope)
    for (const host of ['example.com.br', 'nested.example.com.br', 'provider.co.uk']) {
      assert.equal(scope.FindProxyForURL('', 'cdn.' + host), scope.FindProxyForURL('', host))
    }
  }
})

test('no selected endpoint blocks protected destinations, including onion with an empty registry', () => {
  const context = {}
  vm.runInNewContext(getPacScript({ domains: ['example.com'], ignoredHosts: ['api.example.com'] }), context)
  for (const host of ['example.com', 'a.example.com', 'test.onion', 'test.i2p']) {
    assert.equal(context.FindProxyForURL('', host), 'PROXY 127.0.0.1:0')
  }
  for (const host of ['api.example.com', 'router', '10.0.0.1', 'other.example']) {
    assert.equal(context.FindProxyForURL('', host), 'DIRECT')
  }
})

test('hidden-service subdomains share their root proxy order with or without registry entries', () => {
  const options = { proxies: [
    { id: 'one', protocol: 'HTTP', host: 'one.example', port: 80 },
    { id: 'two', protocol: 'HTTPS', host: 'two.example', port: 443 },
    { id: 'three', protocol: 'SOCKS5', host: 'three.example', port: 1080 },
  ] }
  const hosts = ['a'.repeat(56) + '.onion', 'service.i2p']
  for (const domains of [[], hosts.map(host => `api.${host}`)]) {
    const config = { ...options, domains }
    const router = createRouter(routingConfig(config), findHostMatch, isPrivateHost)
    const scope = {}
    vm.runInNewContext(getPacScript(config), scope)
    for (const host of hosts) {
      for (const prefix of ['', 'api.', 'nested.cdn.']) {
        assert.equal(router(prefix + host).route, router(host).route)
        assert.equal(scope.FindProxyForURL('', prefix + host), router(host).route)
      }
    }
  }
})

test('proxy-all preserves local and explicit exclusions and blocks without a proxy', () => {
  for (const proxies of [[], [{ id: 'one', protocol: 'HTTPS', host: 'one.example', port: 443 }]]) {
    const context = {}
    vm.runInNewContext(getPacScript({ proxyAll: true, ignoredHosts: ['excluded.example'], proxies }), context)
    for (const host of ['public.example', 'other.co.uk', '8.8.8.8']) {
      assert.equal(context.FindProxyForURL('', host), proxies.length ? 'HTTPS one.example:443;' : 'PROXY 127.0.0.1:0')
    }
    for (const host of ['excluded.example', 'cdn.excluded.example', 'router', 'printer.local', '192.168.1.1', '100.64.0.1', '224.1.2.3', '[fd00::1]']) {
      assert.equal(context.FindProxyForURL('', host), 'DIRECT', host)
    }
  }
})
