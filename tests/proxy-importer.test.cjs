const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')

const fixture = (request = async () => 'http://proxy.example:8080') => {
  const storage = { dataConsent: { version: 1, accepted: true }, enableExtension: true, proxies: [], selectedProxyIds: ['builtin'] }
  const alarms = new Map()
  const calls = []
  let lock = Promise.resolve()
  const modules = load('background/proxy-importer', {
    'browser-api': { default: { storage: { local: {
      get: async defaults => JSON.parse(JSON.stringify({ ...defaults, ...storage })),
      set: async values => Object.assign(storage, JSON.parse(JSON.stringify(values))),
    } }, alarms: {
      get: async name => alarms.get(name), clear: async name => alarms.delete(name),
      create: (name, options) => alarms.set(name, options),
    } } },
    'proxy-route': { withProxyLock: work => {
      const result = lock.then(work)
      lock = result.catch(() => {})
      return result
    } },
    request: { requestText: async (url, options) => { calls.push({ url, options }); return request(url, options) } },
  })
  return { storage, calls, alarms, ...modules }
}

test('imports append without selecting entries or overwriting existing credentials', async () => {
  const state = fixture()
  const result = await state.importProxies({ text: 'http://alice:secret@proxy.example:8080\nbad' })
  assert.equal(result.added, 1)
  assert.equal(result.skipped, 1)
  const duplicate = await state.importProxies({ text: 'http://bob:new@proxy.example:8080' })
  assert.equal(duplicate.added, 0)
  assert.equal(state.storage.proxies[0].username, 'alice')
  assert.deepEqual(state.storage.selectedProxyIds, ['builtin'])
  assert.equal(state.storage.useProxy, undefined)
  await state.importProxies({ url: 'https://source.example/proxies' })
  assert.equal(state.calls[0].options.timeout, 60000)
  assert.equal(state.calls[0].options.maxBytes, 32 * 1024 * 1024)
  assert.equal(state.calls[0].options.redirect, 'error')
  await assert.rejects(state.importProxies({ url: 'file:///tmp/proxies' }))
})

test('subscription refresh is opt-in, bounded to one source per alarm, and preserves choices', async () => {
  const state = fixture()
  for (const url of ['https://first.example/list', 'https://second.example/list']) {
    await state.updateSubscriptions({ operation: 'add', url, protocol: 'HTTPS' })
  }
  await state.refreshNextSubscription()
  await state.scheduleSubscriptions()
  assert.equal(state.calls.length, 0)
  assert.equal(state.alarms.size, 0)
  await state.updateSubscriptions({ operation: 'enable', enabled: true })
  state.alarms.set(state.SUBSCRIPTION_ALARM, { periodInMinutes: 30 })
  await state.scheduleSubscriptions()
  assert.equal(state.alarms.get(state.SUBSCRIPTION_ALARM).periodInMinutes, 60)
  await state.refreshNextSubscription()
  await state.refreshNextSubscription()
  assert.deepEqual(state.calls.map(call => new URL(call.url).hostname), ['first.example', 'second.example'])
  assert.equal(state.storage.proxies.length, 1)
  await state.updateSubscriptions({ operation: 'remove', id: state.storage.proxySubscriptions[0].id })
  assert.equal(state.storage.proxies.length, 1)
  state.storage.enableExtension = false
  await state.refreshNextSubscription()
  await state.scheduleSubscriptions()
  assert.equal(state.calls.length, 2)
  assert.equal(state.alarms.size, 0)
})

test('removing a subscription cancels its pending download without holding the route lock', async () => {
  let release
  const state = fixture(async () => new Promise(resolve => { release = resolve }))
  await state.updateSubscriptions({ operation: 'add', url: 'https://source.example/list', protocol: 'HTTP' })
  const id = state.storage.proxySubscriptions[0].id
  const download = state.refreshSubscription({ id })
  while (!release) await new Promise(resolve => setImmediate(resolve))
  await assert.rejects(state.refreshSubscription({ id }))
  await state.updateSubscriptions({ operation: 'remove', id })
  await state.scheduleSubscriptions()
  assert.equal(state.calls[0].options.signal.aborted, true)
  release('http://late.example:80')
  await download
  assert.equal(state.storage.proxies.length, 0)
})

test('PAC restrictions survive imports; recovery is restored but subscriptions stay off', async () => {
  const state = fixture()
  await state.importProxies({ text: 'function FindProxyForURL() { return "PROXY pac.example:80"; }' })
  assert.equal(state.storage.proxies[0].restricted, true)
  const manager = load('background/proxy', {
    'browser-api': { default: { storage: { local: {
      get: async defaults => ({ ...defaults, ...state.storage, selectedProxyIds: [state.storage.proxies[0].id] }),
    } } } }, registry: { default: {} }, 'proxy-route': {},
  }).default
  assert.equal((await manager.getSelectedProxies()).length, 0)
  const settings = load('background/settings', {
    'browser-api': { default: { storage: { local: { set: async values => Object.assign(state.storage, values) } } } },
  }).default
  await settings.importSettingsInBackground({ ...state.storage, proxySubscriptionsEnabled: true, proxyRecoveryEnabled: true,
    proxySubscriptions: [{ id: 'one', protocol: 'HTTPS', url: 'https://source.example/' }] })
  assert.equal(state.storage.proxies[0].restricted, true)
  assert.equal(state.storage.proxySubscriptionsEnabled, false)
  assert.equal(state.storage.proxyRecoveryEnabled, true)
})

test('source validation rejects executable, credential-bearing and duplicate URLs', () => {
  const { validateSourceUrl, validateSubscriptions } = load('background/proxy-source')
  for (const url of ['javascript:alert(1)', 'file:///tmp/x', 'https://user:secret@source.example/',
    'https://source.example/#secret', 'https://source.example/\n']) {
    assert.throws(() => validateSourceUrl(url), url)
  }
  assert.equal(validateSourceUrl('https://ПРИМЕР.РФ/list?token=secret'), 'https://xn--e1afmkfd.xn--p1ai/list?token=secret')
  const record = { id: 'one', protocol: 'HTTPS', url: 'https://source.example/' }
  assert.throws(() => validateSubscriptions([record, { ...record, id: 'two' }]))
})

test('PAC subscriptions use the same static and restricted parsing as file imports', async () => {
  const state = fixture(async () => 'var route = "PROXY one.example:80; PROXY two.example:80; DIRECT";')
  await state.updateSubscriptions({ operation: 'add', url: 'https://source.example/list.pac', protocol: 'HTTPS' })
  await state.refreshSubscription({ id: state.storage.proxySubscriptions[0].id })
  assert.equal(state.storage.proxies.length, 2)
  assert.ok(state.storage.proxies.every(proxy => proxy.restricted && proxy.protocol === 'HTTP'))
})
