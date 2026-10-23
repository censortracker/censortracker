const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const { parseRegistryList, normalizeRegistryDomains, registrySourceKey, validateRegistrySource } = load('background/registry-source-data')
const plain = value => JSON.parse(JSON.stringify(value))
const source = { kind: 'custom', url: 'https://source.example/list?token=secret', enabled: false, autoUpdate: false }

const fixture = (request = async () => 'external.example\ncdn.example.co.uk') => {
  const storage = { registrySource: { ...source }, domains: ['builtin.example'], customProxiedDomains: ['manual.example'],
    enableExtension: false, useProxy: false, externalRegistry: null }
  const listeners = []
  const calls = []
  let queue = Promise.resolve()
  const browser = { storage: { local: {
    get: async defaults => plain({ ...defaults, ...storage }),
    set: async values => {
      Object.assign(storage, plain(values))
      const changes = Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue }]))
      for (const listener of listeners) listener(changes, 'local')
    },
  }, onChanged: { addListener: listener => listeners.push(listener) } } }
  const mocks = {
    'browser-api': { default: browser },
    'proxy-route': { proxyAllowed: async () => storage.enableExtension && storage.useProxy,
      withProxyLock: work => { const result = queue.then(work); queue = result.catch(() => {}); return result } },
    proxy: { default: { setProxyInBackground: async () => storage.applyResult !== false } },
    request: { requestText: async (url, options) => { calls.push({ url, options }); const data = await request(url, options); return typeof data === 'string' && options.metadata ? { data } : data } },
  }
  const api = load('background/registry-source', mocks)
  api.registerRegistrySource()
  const registry = load('background/registry', mocks)
  registry.watchRegistry()
  return { ...api, storage, calls, browser, registry: registry.default }
}

test('external registry parsing keeps full IDNs and nested domains, ignores private entries, and never runs code', async () => {
  const result = await parseRegistryList('# comment\nПРИМЕР.РФ\nshop.example.co.uk\nshop.example.co.uk\n10.0.0.1\nprinter.local')
  assert.deepEqual(plain(result), ['xn--e1afmkfd.xn--p1ai', 'shop.example.co.uk'])
  assert.deepEqual(plain(await parseRegistryList('{"domains":["api.example.com.br"],"code":"throw 1"}')), ['api.example.com.br'])
  assert.deepEqual(plain(await parseRegistryList('["example.com"]')), ['example.com'])
  for (const body of ['', '[]', '{}', '<html>offline</html>', 'valid.example\nbad host',
    'function FindProxyForURL(){ return "DIRECT"; }', '127.0.0.1', '[null]',
    'example.com/restricted/path', 'user@example.com', 'example.com:8080',
    'example.com?query', 'example.com#hash', 'example.com\\\\path', 'a'.repeat(254)]) {
    await assert.rejects(async () => parseRegistryList(body))
  }
  await assert.rejects(normalizeRegistryDomains(Array(1000001).fill('example.com')))
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(parseRegistryList('example.com', controller.signal))
})

test('source operations report PAC failures, but downloads while proxy use is off still work', async () => {
  const state = fixture()
  state.storage.applyResult = false
  await state.refreshRegistrySource()
  await state.updateRegistrySource(source)
  state.storage.enableExtension = true
  state.storage.useProxy = true
  await assert.rejects(state.refreshRegistrySource())
  await assert.rejects(state.updateRegistrySource(source), /could not be applied/)
})

test('manual downloads are bounded, keep disabled choices, and isolate the source cache', async () => {
  const state = fixture()
  await state.refreshRegistrySource({ automatic: true })
  assert.equal(state.calls.length, 0)
  const result = await state.refreshRegistrySource()
  assert.equal(result.count, 2)
  assert.equal(state.calls[0].options.timeout, 30000)
  assert.equal(state.calls[0].options.maxBytes, 32 * 1024 * 1024)
  assert.equal(state.calls[0].options.redirect, 'error')
  assert.deepEqual(state.storage.domains, ['builtin.example'])
  assert.deepEqual(state.storage.customProxiedDomains, ['manual.example'])
  assert.equal(state.storage.useProxy, false)
  assert.equal(state.storage.registrySource.enabled, false)
  assert.equal((await state.registry.getDomainStatus('external.example')).blocked, false)
  await state.updateRegistrySource({ ...source, enabled: true })
  assert.equal((await state.registry.getDomainStatus('external.example')).blocked, true)
  assert.equal((await state.registry.getDomainStatus('child.cdn.example.co.uk')).blocked, true)
  await state.browser.storage.local.set({ ignoredHosts: ['external.example'] })
  assert.equal(await state.registry.contains('child.external.example'), false)
})

test('empty or failed source responses keep the last valid cache and redact source URL tokens', async () => {
  for (const request of [async () => '[]', async () => { throw new Error(source.url) }]) {
    const state = fixture(request)
    const cache = { source: registrySourceKey(source), domains: ['previous.example'], updatedAt: 1 }
    state.storage.externalRegistry = cache
    await assert.rejects(state.refreshRegistrySource(), error => error.message === 'External registry update failed')
    assert.deepEqual(state.storage.externalRegistry, cache)
    assert.equal((await state.getRegistrySourceState()).count, 1)
  }
})

test('source edits abort pending downloads and reject stale results and simultaneous starts', async () => {
  let release
  let started
  const ready = new Promise(resolve => { started = resolve })
  const state = fixture(async () => { started(); return new Promise(resolve => { release = resolve }) })
  const pending = state.refreshRegistrySource()
  await assert.rejects(state.refreshRegistrySource())
  await ready
  await state.updateRegistrySource({ ...source, url: 'https://new.example/list' })
  assert.equal(state.calls[0].options.signal.aborted, true)
  release('stale.example')
  await assert.rejects(pending)
  assert.equal(state.storage.externalRegistry, null)
  assert.equal((await state.getRegistrySourceState()).count, 0)
})

test('automatic registry downloads require both explicit options and an enabled extension', async () => {
  const state = fixture()
  for (const values of [{ enabled: false, autoUpdate: true }, { enabled: true, autoUpdate: false }]) {
    state.storage.registrySource = { ...source, ...values }
    state.storage.enableExtension = true
    await state.refreshRegistrySource({ automatic: true })
  }
  state.storage.registrySource = { ...source, enabled: true, autoUpdate: true }
  state.storage.enableExtension = false
  await state.refreshRegistrySource({ automatic: true })
  assert.equal(state.calls.length, 0)
  state.storage.enableExtension = true
  await state.refreshRegistrySource({ automatic: true })
  assert.equal(state.calls.length, 0)
  state.storage.useProxy = true
  await state.refreshRegistrySource({ automatic: true })
  assert.equal(state.calls.length, 1)
})

test('registry backups restore source choices but cannot replace caches', async () => {
  const state = fixture()
  const settings = load('background/settings', { 'browser-api': { default: state.browser } }).default
  await settings.importSettingsInBackground({ registrySource: { ...source, enabled: true, autoUpdate: true },
    externalRegistry: { domains: ['untrusted.example'] } })
  assert.deepEqual(state.storage.registrySource, { ...source, enabled: true, autoUpdate: true })
  assert.equal(state.storage.externalRegistry, null)
  for (const invalid of [null, [], { ...source, url: 'javascript:alert(1)' }, { ...source, enabled: 'true' },
    { ...source, url: '', enabled: true }, { ...source, url: 'https://alice:secret@example.com/list' }]) {
    assert.throws(() => validateRegistrySource(invalid))
  }
})

test('the Anticensority source uses static data parsing and the same opt-in cache boundary', async () => {
  const { registrySourceUrls } = load('background/registry-source-data')
  const state = fixture(async () => 'const inputs = {"HOSTNAMES":{"11":"example.com"}};\n')
  await state.updateRegistrySource({kind: 'anticensority', url: registrySourceUrls.anticensority, enabled: false, autoUpdate: false})
  assert.equal(state.calls.length, 0)
  assert.equal((await state.refreshRegistrySource()).count, 1)
  assert.equal(state.storage.registrySource.enabled, false)
  assert.equal(state.storage.useProxy, false)
  assert.deepEqual(state.storage.externalRegistry.domains, ['example.com'])
})

test('external ETag checks skip parsing, storage writes, and proxy application', async () => {
  for (const kind of ['custom', 'anticensority']) {
    let etag = '"1"'
    const state = fixture(async (url, options) => ({ etag, finalUrl: url,
      data: options.method === 'HEAD' ? undefined : kind === 'custom'
        ? 'example.com' : 'const inputs = {"HOSTNAMES":{"11":"example.com"}};',
    }))
    state.storage.registrySource.kind = kind
    if (kind === 'anticensority') state.storage.registrySource.url =
      load('background/registry-source-data').registrySourceUrls.anticensority
    await state.refreshRegistrySource()
    const saved = plain(state.storage.externalRegistry)
    state.storage.enableExtension = true
    state.storage.useProxy = true
    state.storage.applyResult = false // A repeated proxy application would fail.
    await state.refreshRegistrySource()
    assert.deepEqual(state.storage.externalRegistry, saved)
    assert.deepEqual(state.calls.map(call => call.options.method), ['GET', 'HEAD'])
    etag = '"2"'
    state.storage.applyResult = true
    await state.refreshRegistrySource()
    assert.deepEqual(state.calls.map(call => call.options.method), ['GET', 'HEAD', 'HEAD', 'GET'])
    assert.equal(state.storage.externalRegistry.cache.etag, etag)
  }
})
