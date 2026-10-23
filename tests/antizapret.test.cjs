const assert = require('node:assert/strict')
const { test } = require('node:test')
const vm = require('node:vm')
const load = require('./load.cjs')
const plain = value => JSON.parse(JSON.stringify(value))
const fixture = (request = async url => url.endsWith('.pac')
  ? 'function FindProxyForURL(){ return "HTTPS proxy.example:443; DIRECT"; }'
  : 'blocked.example\ncdn.example.co.uk') => {
  const storage = { proxies: [], selectedProxyIds: ['builtin'], useProxy: false }
  const calls = []
  const listeners = []
  const mocks = {
    'browser-api': { default: { storage: { local: {
      get: async defaults => ({ ...defaults, ...storage }),
      set: async values => {
        Object.assign(storage, plain(values))
        const changes = Object.fromEntries(Object.keys(values).map(key => [key, {}]))
        for (const listener of listeners) listener(changes, 'local')
      },
    }, onChanged: { addListener: listener => listeners.push(listener) } } } },
    proxy: { default: { setProxyInBackground: async () => false } },
    'proxy-route': { withProxyLock: work => work(), proxyAllowed: async () => false, getProbeRoutes: () => [] },
    request: { requestText: async (url, options) => { calls.push({ url, options }); return request(url) } },
  }
  return { ...load('background/antizapret', mocks), storage, calls, mocks }
}

test('Antizapret downloads are explicit, bounded, and do not change selected proxies', async () => {
  const state = fixture()
  assert.equal(state.calls.length, 0)
  assert.equal((await state.importAntizapret()).added, 1)
  assert.equal(state.calls.length, 2)
  assert.ok(state.calls.every(({options}) => options.timeout === 30000 && options.redirect === 'error'))
  assert.deepEqual(state.storage.selectedProxyIds, ['builtin'])
  assert.equal(state.storage.useProxy, false)
  assert.equal(state.storage.proxies[0].provider, 'antizapret')
  assert.equal(state.storage.proxies[0].restricted, true)
  assert.equal((await state.importAntizapret()).added, 0)
  const { updateProxyList } = load('background/proxy-list', state.mocks)
  await updateProxyList({ operation: 'save', proxy: { ...state.storage.proxies[0], provider: undefined, restricted: false } })
  assert.equal(state.storage.proxies[0].provider, 'antizapret')
  assert.equal(state.storage.proxies[0].restricted, true)
  const { validateSettings } = load('background/settings-data')
  const imported = validateSettings(state.storage)
  assert.equal(imported.proxies[0].provider, 'antizapret')
  assert.equal(imported.antizapret, undefined, 'Backup data must not supply allowed targets or endpoints')
})

test('Antizapret preserves caches on failed downloads and reserves simultaneous jobs', async () => {
  let release
  const response = new Promise(resolve => { release = resolve })
  const state = fixture(async () => response)
  const pending = state.importAntizapret()
  await assert.rejects(state.importAntizapret())
  release('bad host')
  await assert.rejects(pending)
  for (const body of ['<html>403</html>', '', 'function FindProxyForURL(){return "DIRECT";}']) {
    const failed = fixture(async () => body)
    failed.storage.antizapret = { domains: ['cached.example'], proxyKeys: [], updatedAt: 1 }
    await assert.rejects(failed.importAntizapret())
    assert.deepEqual(failed.storage.antizapret.domains, ['cached.example'])
    assert.equal(failed.storage.proxies.length, 0)
  }
})

test('named-source import upgrades only restricted duplicate endpoints without replacing user data', async () => {
  for (const restricted of [true, false]) {
    const state = fixture()
    state.storage.proxies = [{id: 'saved', name: 'My proxy', protocol: 'HTTPS', host: 'proxy.example',
      port: 443, username: 'alice', password: 'secret', restricted}]
    state.storage.selectedProxyIds = ['saved']
    assert.equal((await state.importAntizapret()).added, 0)
    const record = state.storage.proxies[0]
    assert.equal(record.id, 'saved')
    assert.equal(record.name, 'My proxy')
    assert.equal(record.password, 'secret')
    assert.equal(record.provider, restricted ? 'antizapret' : undefined)
    assert.deepEqual(state.storage.selectedProxyIds, ['saved'])
  }
})

test('provider routes enforce domain limits in PAC and runtime, including proxy-all mode', async () => {
  const state = fixture()
  await state.importAntizapret()
  state.storage.selectedProxyIds = [state.storage.proxies[0].id]
  const { proxy, ...mocks } = state.mocks
  const loaded = load('background/proxy', { ...mocks, registry: { default: { getRoutingDomains: async () => ['manual.example'] } } })
  loaded.watchProxyCache()
  const manager = loaded.default
  const { getPacScript } = load('background/pac')
  const { createRouter, routingConfig } = load('background/routing')
  const { findHostMatch } = load('background/host-match')
  const { isPrivateHost } = load('background/private-host')
  assert.deepEqual(plain(await manager.getProxyingRules()), {}, 'Provider proxies cannot serve arbitrary control requests')
  let cachedDomains
  for (const proxyAll of [false, true]) {
    state.storage.proxyAll = proxyAll
    state.storage.ignoredHosts = ['ignored.blocked.example']
    const options = await manager.getRoutingOptions()
    if (cachedDomains) assert.equal(options.providerDomains, cachedDomains)
    cachedDomains = options.providerDomains
    const context = {}
    vm.runInNewContext(getPacScript(options), context)
    const router = createRouter(routingConfig(options), findHostMatch, isPrivateHost)
    for (const host of ['blocked.example', 'child.cdn.example.co.uk', 'manual.example', 'other.example', 'ignored.blocked.example', '10.0.0.1']) {
      assert.equal(context.FindProxyForURL('', host), router(host).route)
    }
    assert.equal(router('blocked.example').type, 'proxy')
    assert.equal(router('manual.example').type, 'blocked')
    assert.equal(router('other.example').type, proxyAll ? 'blocked' : 'direct')
    assert.equal(router('ignored.blocked.example').type, 'direct')
    assert.equal(router('10.0.0.1').type, 'direct')
  }
  await mocks['browser-api'].default.storage.local.set({ antizapret: { ...state.storage.antizapret, proxyKeys: [] } })
  const context = {}
  vm.runInNewContext(getPacScript(await manager.getRoutingOptions()), context)
  assert.equal(context.FindProxyForURL('', 'blocked.example'), 'PROXY 127.0.0.1:0')
})
