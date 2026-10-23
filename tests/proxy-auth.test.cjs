const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const plain = value => JSON.parse(JSON.stringify(value))
const record = { id: 'one', protocol: 'HTTP', host: 'proxy.example', port: 80,
  username: 'alice', password: 'secret' }
const fixture = (firefox = false) => {
  const listeners = {}
  let override = null
  let enabled = true
  const event = name => ({ addListener: (fn, filter, flags) => { listeners[name] = { fn, flags } } })
  const browser = { isFirefox: firefox,
    webRequest: { onAuthRequired: event('auth'), onCompleted: event('done'), onErrorOccurred: event('error') },
    proxy: { onRequest: event('proxy') } }
  const api = load('background/proxy-auth', {
    'browser-api': { default: browser },
    'proxy-route': { proxyRequestAllowed: async () => enabled, getServiceRoute: () => override },
    proxy: { default: { getSelectedProxies: async () => [record],
      getRouteForHost: async host => ({ type: host === 'protected.example' ? 'proxy' : 'direct', proxies: host === 'protected.example' ? [record] : [] }) } },
  })
  return { ...api, listeners, setOverride: value => { override = value }, disable: () => { enabled = false } }
}

test('proxy credentials validate types, protocol limits, backup retention, and PAC secrecy', () => {
  const { validateProxy, proxyAuthSupported } = load('background/proxy-record')
  const { validateSettings } = load('background/settings-data')
  const { getPacScript } = load('background/pac')
  assert.equal(validateProxy(record).password, 'secret')
  assert.equal(validateSettings({ proxies: [record], selectedProxyIds: ['one'] }).proxies[0].username, 'alice')
  assert.doesNotMatch(getPacScript({ domains: ['example.com'], proxies: [record] }), /alice|secret|password|username/)
  for (const change of [{ username: null }, { password: {} }, { username: 'a:b' },
    { password: 'line\nbreak' }, { protocol: 'SOCKS4' },
    { protocol: 'SOCKS5', password: '' }, { protocol: 'SOCKS5', username: 'ю'.repeat(128) }]) {
    assert.throws(() => validateProxy({ ...record, ...change }))
  }
  assert.equal(proxyAuthSupported({ ...record, protocol: 'SOCKS5' }, false), false)
  assert.equal(proxyAuthSupported({ ...record, protocol: 'SOCKS5' }, true), true)
  assert.equal(validateProxy({ ...record, protocol: 'SOCKS5', username: 'alice:session' }).username, 'alice:session')
})

test('HTTP auth matches the selected challenger and never answers origin authentication', async () => {
  const { createAuthHandler } = fixture()
  const { handle, clear } = createAuthHandler(async () => [record])
  const details = { requestId: 'request', isProxy: true, challenger: { host: 'proxy.example', port: 80 } }
  assert.deepEqual(plain(await handle({ ...details, isProxy: false })), {})
  assert.deepEqual(plain(await handle({ ...details, challenger: { host: 'evil.example', port: 80 } })), {})
  assert.deepEqual(plain(await handle({ ...details, challenger: { host: 'proxy.example', port: 81 } })), {})
  assert.deepEqual(plain(await handle(details)), { authCredentials: { username: 'alice', password: 'secret' } })
  assert.deepEqual(plain(await handle(details)), { cancel: true })
  clear(details)
  assert.ok((await handle(details)).authCredentials)
})

test('checks cancel missing HTTP credentials without opening a browser authentication prompt', async () => {
  const { createAuthHandler } = fixture()
  const failed = []
  const proxy = { ...record, username: '', password: '', checking: true }
  const { handle } = createAuthHandler(async () => [proxy], id => failed.push(id))
  const details = { requestId: 'probe', isProxy: true, challenger: { host: proxy.host, port: proxy.port } }
  assert.deepEqual(plain(await handle(details)), { cancel: true })
  assert.deepEqual(failed, ['one'])
  proxy.checking = false
  assert.deepEqual(plain(await handle(details)), {})
})

test('auth honors direct service overrides and disabled proxy use', async () => {
  const state = fixture()
  const { handle } = state.createAuthHandler()
  const details = { requestId: 'one', url: 'https://protected.example/', isProxy: true,
    challenger: { host: 'proxy.example', port: 80 } }
  state.setOverride({ hostname: 'protected.example', route: 'DIRECT' })
  assert.deepEqual(plain(await handle(details)), {})
  state.setOverride({ hostname: 'protected.example', route: 'PROXY proxy.example:80' })
  assert.ok((await handle(details)).authCredentials)
  state.disable()
  assert.deepEqual(plain(await handle({ ...details, requestId: 'two' })), {})
})

test('HTTP authentication accepts an unbracketed IPv6 browser challenger', async () => {
  const { createAuthHandler } = fixture(true)
  const { handle } = createAuthHandler(async () => [{ ...record, host: '[::1]' }])
  const result = await handle({ requestId: 'ipv6', isProxy: true,
    challenger: { host: '::1', port: 80 } })
  assert.equal(result.authCredentials.username, 'alice')
})

test('browser auth registration uses Chrome callbacks and Firefox promises with cleanup', async () => {
  for (const firefox of [false, true]) {
    const state = fixture(firefox)
    state.registerProxyAuth()
    assert.deepEqual(Array.from(state.listeners.auth.flags), [firefox ? 'blocking' : 'asyncBlocking'])
    const details = { requestId: 'one', url: 'https://protected.example/', isProxy: true,
      challenger: { host: 'proxy.example', port: 80 } }
    const result = firefox ? await state.listeners.auth.fn(details)
      : await new Promise(resolve => assert.equal(state.listeners.auth.fn(details, resolve), undefined))
    assert.ok(result.authCredentials)
    state.listeners.done.fn(details)
    assert.equal(Boolean(state.listeners.proxy), firefox)
  }
})

test('Firefox SOCKS authentication uses remote DNS and retains the blocking PAC fallback', async () => {
  const socks = { ...record, protocol: 'SOCKS5', host: '[::1]' }
  const state = load('background/proxy-auth', {
    'browser-api': { default: {} },
    'proxy-route': { proxyRequestAllowed: async () => true, getServiceRoute: () => null },
    proxy: { default: { getRouteForHost: async host => ({ type: host === 'protected.example' ? 'proxy' : 'direct', proxies: host === 'protected.example' ? [socks, record] : [] }) } },
  })
  const result = plain(await state.handleFirefoxProxy({ url: 'https://protected.example/' }))
  assert.equal(result[0].type, 'socks')
  assert.equal(result[0].host, '::1')
  assert.equal(result[0].proxyDNS, true)
  assert.equal(result[0].username, 'alice')
  assert.equal(result[1].username, undefined)
  assert.ok(result.every(proxy => proxy !== null))
  assert.deepEqual(plain(await state.handleFirefoxProxy({ url: 'https://direct.example/' })), null)
})

test('Firefox requests remote DNS only for SOCKS5, not plain SOCKS4', () => {
  const { firefoxProxyInfo } = fixture(true)
  for (const protocol of ['HTTP', 'HTTPS', 'SOCKS4', 'SOCKS5']) {
    const info = firefoxProxyInfo({ ...record, protocol, username: '', password: '' })
    assert.equal(Boolean(info.proxyDNS), protocol === 'SOCKS5', protocol)
  }
})

test('Firefox routes HTTP through the same listener and respects inactive and service-direct routes', async () => {
  const state = fixture(true)
  const result = plain(await state.handleFirefoxProxy({url: 'https://protected.example/'}))
  assert.equal(result[0].type, 'http')
  assert.ok(result.every(proxy => proxy !== null))
  state.setOverride({hostname: 'protected.example', route: 'DIRECT'})
  assert.deepEqual(plain(await state.handleFirefoxProxy({url: 'https://protected.example/'})), null)
  state.disable()
  assert.equal(await state.handleFirefoxProxy({url: 'https://protected.example/'}), undefined)
})

test('permission loss during an awaited Firefox route prevents proxy and credential use', async () => {
  for (const reason of ['disabled', 'controlled_by_other_extensions']) {
    let allowed = true
    let release
    const route = new Promise(resolve => { release = resolve })
    const state = load('background/proxy-auth', {'browser-api': {default: {}},
      'proxy-route': {proxyRequestAllowed: async () => allowed, getServiceRoute: () => null},
      proxy: {default: {getRouteForHost: async () => route}}})
    const pending = state.handleFirefoxProxy({url: 'https://protected.example/'})
    const auth = state.createAuthHandler().handle({url: 'https://protected.example/', requestId: 'pending',
      isProxy: true, challenger: {host: record.host, port: record.port}})
    await new Promise(resolve => setImmediate(resolve))
    allowed = false
    release({type: 'proxy', proxies: [record]})
    assert.equal(await pending, undefined, reason)
    assert.deepEqual(plain(await auth), {}, reason)
  }
})

test('valid browser hostnames with underscores retain shared router semantics', async () => {
  const { createRouter, routingConfig } = load('background/routing')
  const { findHostMatch } = load('background/host-match')
  const { isPrivateHost } = load('background/private-host')
  for (const proxyAll of [false, true]) {
    const route = createRouter(routingConfig({proxyAll, proxies: [record]}), findHostMatch, isPrivateHost)
    const state = load('background/proxy-auth', {'browser-api': {default: {}},
      'proxy-route': {proxyRequestAllowed: async () => true, getServiceRoute: () => null},
      proxy: {default: {getRouteForHost: async host => ({...route(host), proxies: route(host).proxies.map(() => record)})}}})
    for (const host of ['file_server.local', 'file_server']) {
      assert.deepEqual(plain(await state.handleFirefoxProxy({url: 'http://' + host + '/'})), null)
    }
    const result = plain(await state.handleFirefoxProxy({url: 'http://my_host.example/'}))
    assert.equal(proxyAll ? result[0].type : result, proxyAll ? 'http' : null)
  }
})
