const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const vm = require('node:vm')
const { isPrivateHost } = load('background/private-host')

test('private, local, multicast, and shared addresses stay direct without DNS', () => {
  for (const host of ['localhost', 'router', 'printer.local', 'a.LOCALHOST.', 'router.home.arpa',
    '0.0.0.0', '10.255.255.255', '127.3.2.1', '100.64.0.0', '100.127.255.255',
    '169.254.1.1', '172.16.0.0', '172.31.255.255', '192.168.0.1', '224.0.0.1', '255.255.255.255',
    '[::]', '::1', '[fc00::1]', 'fdff::1', 'fe80::1', 'febf::1', 'ff02::1',
    '[::ffff:192.168.0.1]', '::ffff:a00:1', '0:0:0:0:0:ffff:6440:1', '64:ff9b::a00:1',
    '64:ff9b:1::a00:1', '64:ff9b:1:ffff:ffff:ffff:ffff:ffff']) {
    assert.equal(isPrivateHost(host), true, host)
  }
  for (const host of ['example.com', 'notlocalhost.com', 'local.example.com',
    '100.63.255.255', '100.128.0.0', '172.15.255.255', '172.32.0.0', '169.253.1.1',
    '8.8.8.8', '1.1.1.1', '223.255.255.255', '[2001:4860::8888]',
    '::ffff:808:808', '64:ff9b::808:808', '64:ff9b:2::1']) {
    assert.equal(isPrivateHost(host), false, host)
  }
})

test('PAC bypass takes priority over explicit proxy rules', () => {
  const { getPacScript } = load('background/pac')
  const domains = ['router', 'printer.local', '10.0.0.1', '100.64.0.1', '224.0.0.1',
    '[fd00::1]', '[::ffff:10.0.0.1]', '8.8.8.8', 'public.example']
  const context = {}
  vm.runInNewContext(getPacScript({ domains,
    proxies: [{ protocol: 'HTTPS', host: 'proxy.example', port: 443 }] }), context)
  for (const host of domains.slice(0, -2)) {
    assert.equal(context.FindProxyForURL('', host), 'DIRECT', host)
  }
  for (const host of domains.slice(-2)) {
    assert.match(context.FindProxyForURL('', host), /^HTTPS/)
  }
})

test('local network suffixes bypass proxies in normal and proxy-all modes', () => {
  const { getPacScript } = load('background/pac')
  const { createRouter, routingConfig } = load('background/routing')
  const { findHostMatch } = load('background/host-match')
  const local = ['localdomain', 'intranet', 'corp', 'private', 'test', 'invalid']
    .map(suffix => `service.${suffix}`)
  const publicHosts = ['localdomain.com', 'corp.example', 'notprivate.example', 'app.test.example']
  for (const proxyAll of [false, true]) {
    const options = { proxyAll, domains: [...local, ...publicHosts],
      proxies: [{ id: 'one', protocol: 'HTTPS', host: 'proxy.example', port: 443 }] }
    const router = createRouter(routingConfig(options), findHostMatch, isPrivateHost)
    const scope = {}
    vm.runInNewContext(getPacScript(options), scope)
    for (const host of local) {
      for (const name of [host, `NESTED.${host.toUpperCase()}.`]) {
        assert.equal(isPrivateHost(name), true, name)
        assert.equal(router(name).route, 'DIRECT', name)
        assert.equal(scope.FindProxyForURL('', name), 'DIRECT', name)
      }
    }
    for (const host of publicHosts) {
      assert.equal(isPrivateHost(host), false, host)
      assert.match(router(host).route, /^HTTPS/, host)
      assert.match(scope.FindProxyForURL('', host), /^HTTPS/, host)
    }
  }
})
