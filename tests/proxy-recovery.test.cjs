const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const { proxyFingerprint } = load('background/proxy-check-data')

const builtin = { id: 'builtin', protocol: 'HTTPS', host: 'managed.example', port: 443 }
const custom = { id: 'one', protocol: 'HTTP', host: 'custom.example', port: 8080 }
const fixture = (proxies = [custom]) => {
  const storage = { enableExtension: true, useProxy: true, selectedProxyIds: proxies.map(proxy => proxy.id),
    currentProxyServer: 'managed.example', proxyFailures: {}, badProxies: [] }
  const events = []
  const alarms = new Map()
  let current = proxies
  let routeType = 'proxy'
  let checking = false
  let queue = Promise.resolve()
  const listeners = []
  const browser = { storage: { local: {
    get: async defaults => ({ ...defaults, ...storage }),
    set: async values => {
      Object.assign(storage, JSON.parse(JSON.stringify(values)))
      for (const listener of listeners) listener(Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { newValue: value }])), 'local')
    },
  }, onChanged: { addListener: listener => listeners.push(listener) } },
  alarms: { get: async name => alarms.get(name), create: (name, options) => alarms.set(name, options), clear: async name => alarms.delete(name) } }
  const api = load('background/proxy-recovery', {
    'browser-api': { default: browser },
    proxy: { default: {
      getRouteForHost: async () => ({ type: routeType, proxies }), getSelectedProxies: async () => current,
      setProxyInBackground: async () => { events.push('apply'); return true }, setProxy: async () => events.push('apply'),
    } },
    'proxy-route': { getProbeRoutes: () => [{ hostname: 'probe.example' }],
      proxyAllowed: async () => storage.enableExtension && storage.useProxy,
      withProxyLock: work => { const result = queue.then(work); queue = result.catch(() => {}); return result },
    },
    'proxy-check': { getProxyCheckState: async () => ({ run: { running: checking } }),
      startProxyChecks: async args => events.push({ check: JSON.parse(JSON.stringify(args)) }) },
    server: { synchronizeInBackground: async options => events.push({ sync: JSON.parse(JSON.stringify(options)) }) },
  })
  return { ...api, storage, events, browser, alarms, setCurrent: value => { current = value },
    setRoute: value => { routeType = value }, setChecking: value => { checking = value } }
}
const error = { error: 'net::ERR_PROXY_CONNECTION_FAILED', url: 'https://protected.example/', tabId: 1 }

test('known failures get a cooldown without changing user choices or requesting IP services', async () => {
  const state = fixture()
  await state.recoverProxy(error)
  assert.deepEqual(state.storage.selectedProxyIds, ['one'])
  assert.equal(state.storage.useProxy, true)
  assert.ok(state.storage.proxyFailures.one.retryAt > Date.now() + 290000)
  assert.equal(state.storage.proxyFailures.one.fingerprint, await proxyFingerprint(custom))
  assert.deepEqual(state.events, ['apply'])
  await state.recoverProxy(error)
  assert.deepEqual(state.events, ['apply'], 'Repeated failures must be throttled')
})

test('Chromium pool failures never blacklist a guessed endpoint; Firefox reports a specific endpoint', async () => {
  const chrome = fixture([builtin, custom])
  await chrome.recoverProxy(error)
  assert.deepEqual(chrome.storage.badProxies, [])
  assert.deepEqual(chrome.storage.proxyFailures, {})
  assert.deepEqual(chrome.events[1], { sync: { syncRegistry: false, syncProxy: true } })
  const firefox = fixture([builtin, custom])
  await firefox.recoverProxy({ ...error, error: 'NS_ERROR_PROXY_CONNECTION_REFUSED', proxyInfo: { host: custom.host, port: custom.port } })
  assert.ok(firefox.storage.proxyFailures.one)
  assert.equal(firefox.storage.proxyFailures.builtin, undefined)
  assert.deepEqual(firefox.storage.badProxies, [])
  assert.deepEqual(firefox.storage.selectedProxyIds, ['builtin', 'one'])
})

test('simultaneous errors reserve recovery before any awaited permission check', async () => {
  const state = fixture([builtin])
  await Promise.all([state.recoverProxy(error), state.recoverProxy(error), state.recoverProxy(error)])
  assert.equal(state.events.filter(event => event.sync).length, 1)
  assert.equal(state.events.filter(event => event === 'apply').length, 2)
})

test('Firefox recovery distinguishes protocols at one endpoint and rejects ambiguous reports', async () => {
  const secure = { ...custom, id: 'secure', protocol: 'HTTPS' }
  const state = fixture([custom, secure])
  await state.recoverProxy({ ...error, proxyInfo: { host: custom.host, port: custom.port } })
  assert.deepEqual(state.storage.proxyFailures, {})
  await state.recoverProxy({ ...error, proxyInfo: { host: custom.host, port: custom.port, type: 'https' } })
  assert.ok(state.storage.proxyFailures.secure)
  assert.equal(state.storage.proxyFailures.one, undefined)
})

test('internal, probe, direct, authentication and stale endpoint errors do not start recovery', async () => {
  for (const details of [{}, { ...error, error: new Error('PAC error') }, { ...error, tabId: -1 },
    { ...error, url: 'https://probe.example/' }, { ...error, error: 'ERR_PROXY_AUTH_REQUESTED' },
    { ...error, error: 'ERR_TUNNEL_CONNECTION_FAILED' },
    { ...error, proxyInfo: { host: 'previous.example', port: 8080 } }]) {
    const state = fixture()
    await state.recoverProxy(details)
    assert.equal(state.events.length, 0)
    assert.deepEqual(state.storage.proxyFailures, {})
  }
  const state = fixture()
  state.setRoute('direct')
  await state.recoverProxy(error)
  state.setRoute('proxy')
  state.storage.useProxy = false
  await state.recoverProxy(error)
  assert.equal(state.events.length, 0)
})

test('a managed endpoint changed during recovery is not blacklisted, and deselection stops refresh', async () => {
  const state = fixture([builtin])
  state.setCurrent([{ ...builtin, host: 'new.example' }])
  state.storage.currentProxyServer = 'new.example'
  await state.recoverProxy(error)
  assert.deepEqual(state.storage.badProxies, [])
  const lateChange = fixture([builtin])
  lateChange.storage.currentProxyServer = 'new.example'
  await lateChange.recoverProxy(error)
  assert.deepEqual(lateChange.storage.badProxies, [], 'A later storage snapshot must match the failed endpoint too')
  const deselected = fixture([builtin])
  deselected.setCurrent([custom])
  await deselected.recoverProxy(error)
  assert.deepEqual(deselected.events, ['apply'])
})

test('automatic recovery is opt-in, checks at most four due selected proxies, and skips saved credentials', async () => {
  const proxies = Array.from({ length: 7 }, (_, index) => ({ ...custom, id: `proxy-${index}`, port: 8080 + index,
    ...(index === 0 ? { username: 'alice', password: 'secret' } : {}) }))
  const state = fixture(proxies)
  for (const proxy of proxies) state.storage.proxyFailures[proxy.id] = { retryAt: 1, fingerprint: await proxyFingerprint(proxy) }
  await state.retryFailedProxies()
  assert.equal(state.events.length, 0)
  state.storage.proxyRecoveryEnabled = true
  await state.retryFailedProxies()
  assert.deepEqual(state.events, [{ check: { ids: ['proxy-1', 'proxy-2', 'proxy-3', 'proxy-4'], automatic: true } }])
  state.setChecking(true)
  await state.retryFailedProxies()
  assert.equal(state.events.length, 1)
  state.alarms.set(state.RECOVERY_ALARM, { periodInMinutes: 5 })
  await state.registerProxyRecovery()
  assert.equal(state.alarms.get(state.RECOVERY_ALARM).periodInMinutes, 60)
})

test('extension updates and navigation keep disabled settings disabled', async () => {
  const calls = []
  const handlers = load('background/handlers', {
    'extension-notices': { activateNotices: async () => false },
    'browser-api': { default: { runtime: { OnInstalledReason: { UPDATE: 'update', INSTALL: 'install' } },
      storage: { local: { get: async () => ({ useLocalProxy: false, dataConsent: { version: 1, accepted: true } }) } },
      alarms: { clear: async () => {} } } },
    settings: { default: { extensionEnabled: async () => false, enableExtension: async () => calls.push('enable') } },
    proxy: { default: { isEnabled: async () => true, syncLocalProxy: async () => {},
      setProxy: async () => calls.push('set'), ping: async () => calls.push('ping') } },
    task: { default: { schedule: async () => calls.push('schedule') } },
    server: { synchronize: async () => calls.push('sync') },
    'proxy-importer': {}, 'proxy-recovery': {}, 'proxy-route': { withProxyLock: operation => operation() },
  })
  await handlers.handleInstalled({ reason: 'update' })
  await handlers.handleBeforeRequest({})
  assert.deepEqual(calls, ['schedule'])
  const manager = load('background/proxy', {
    'browser-api': { default: {} }, 'proxy-route': { proxyAllowed: async () => false }, registry: { default: {} },
  }).default
  await manager.pingInBackground()
})
