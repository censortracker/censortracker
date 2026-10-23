const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const { settingsDefaults, validateSettings } = load('background/settings-data')
const loadSettings = mocks => load('background/settings', {
  ...mocks,
  'browser-api': { ...mocks['browser-api'],
    getDetailedBrowserInfo: async () => ({ name: 'Firefox', version: '142.0.1' }),
    default: { ...mocks['browser-api'].default,
      runtime: { getManifest: () => ({ version: '20.0.0', manifest_version: 2 }) },
    },
  },
})
const plain = value => JSON.parse(JSON.stringify(value))
const defaultProxies = { proxies: [], selectedProxyIds: ['builtin'] }

test('settings imports allow only user choices, not runtime state or code', () => {
  const input = JSON.parse('{"useProxy":false,"domains":["evil.example"],"serviceRouteSnapshot":{"owned":true},"proxyServerURI":"evil:80","__proto__":{"polluted":true},"constructor":{}}')
  assert.deepEqual(plain(validateSettings(input)), { useProxy: false, ...defaultProxies })
  assert.equal({}.polluted, undefined)
  assert.deepEqual(plain(validateSettings({ formatVersion: 1, settings: {
    ignoredHosts: [' ПРИМЕР.РФ ', 'xn--e1afmkfd.xn--p1ai'], currentRegionCode: 'BY',
  } })), { ignoredHosts: ['xn--e1afmkfd.xn--p1ai'], currentRegionCode: 'BY', ...defaultProxies })
})

test('settings API keeps runtime state and exports a versioned user-only backup', async () => {
  const storage = { domains: ['cached.example'], serviceRouteSnapshot: { owned: true },
    useProxy: true, currentRegionCode: 'BY', proxyIsAlive: false }
  let writes = 0
  const browser = { storage: { local: {
    get: async () => storage,
    set: async values => { writes++; Object.assign(storage, plain(values)) },
    clear: () => { throw new Error('Must not clear storage') },
  } } }
  const settings = loadSettings({
    'browser-api': { default: browser },
  }).default
  const backup = plain(await settings.exportSettings())
  assert.equal(new Date(backup.exportedAt).toISOString(), backup.exportedAt)
  assert.equal(backup.extensionVersion, '20.0.0')
  assert.deepEqual(backup.browser, { name: 'Firefox', version: '142.0.1' })
  assert.equal(backup.manifestVersion, 2)
  assert.deepEqual(backup.settings, { ...plain(settingsDefaults), ...defaultProxies, useProxy: true, currentRegionCode: 'BY' })
  await assert.rejects(settings.importSettingsInBackground({ useProxy: false, ignoredHosts: [null] }))
  await assert.rejects(settings.importSettingsInBackground({ reportType: 'censortracker-diagnostics' }))
  assert.equal(writes, 0)
  await settings.importSettingsInBackground({ formatVersion: 1, settings: { useProxy: false, serviceRouteSnapshot: {} } })
  assert.equal(storage.useProxy, false)
  assert.deepEqual(storage.domains, ['cached.example'])
  assert.deepEqual(storage.serviceRouteSnapshot, { owned: true })
  storage.customProxyProtocol = 'HTTP'
  storage.customProxyServerURI = 'old.example:80'
  storage.ignoredHosts = ['old.example']
  storage.localProxyURI = '127.0.0.1:10808'
  await settings.importSettingsInBackground({ useOwnProxy: false, useLocalProxy: false })
  assert.equal(storage.uiLanguage, 'auto')
  assert.equal(storage.customProxyServerURI, '')
  assert.deepEqual(storage.ignoredHosts, [])
  assert.equal(storage.localProxyURI, null)
  await settings.importSettingsInBackground({ useLocalProxy: true, localProxyURI: 'evil.example:80' })
  assert.equal(storage.localProxyURI, null)
  assert.equal(storage.localProxyAlive, false)
  assert.deepEqual(storage.domains, ['cached.example'])
})

for (const enabled of [false, true]) {
  test(`backup round trip preserves registry and recovery choices: ${enabled}`, async () => {
    const source = { kind: 'custom', url: 'https://registry.example/list', enabled, autoUpdate: enabled }
    const storage = { registrySource: source, proxyRecoveryEnabled: enabled, domains: ['cached.example'] }
    const settings = loadSettings({ 'browser-api': { default: { storage: { local: {
      get: async () => storage, set: async values => Object.assign(storage, plain(values)),
    } } } } }).default
    const backup = await settings.exportSettings()
    storage.registrySource = { ...source, enabled: !enabled, autoUpdate: !enabled }
    storage.proxyRecoveryEnabled = !enabled
    await settings.importSettingsInBackground(backup)
    assert.deepEqual(storage.registrySource, source)
    assert.equal(storage.proxyRecoveryEnabled, enabled)
    assert.deepEqual(storage.domains, ['cached.example'])
  })
}

test('export migrates a legacy selection before it applies defaults', async () => {
  const settings = loadSettings({
    'browser-api': { default: { storage: { local: { get: async () => ({
      customProxyProtocol: 'HTTP', customProxyServerURI: 'legacy.example:80',
    }) } } } },
  }).default
  assert.deepEqual(Array.from((await settings.exportSettings()).settings.selectedProxyIds), ['legacy'])
})

test('invalid known settings reject the full import before any write', () => {
  for (const input of [null, [], { formatVersion: 2 }, { formatVersion: 1, settings: [] },
    { useProxy: 'false' }, { proxyAll: 'true' }, { ignoredHosts: 'example.com' }, { customProxiedDomains: [null] },
    { uiLanguage: 'fr' }, { uiLanguage: null }, { uiLanguage: 1 },
    { currentRegionCode: 'Russia' }, { customProxyProtocol: 'DIRECT' },
    { customProxyServerURI: "host:1'; alert(1);'" }]) {
    assert.throws(() => validateSettings(input))
  }
})

test('language choices survive settings export and import', async () => {
  for (const uiLanguage of ['auto', 'en', 'ru', 'uk']) {
    const storage = { uiLanguage }
    const settings = loadSettings({
      'browser-api': { default: { storage: { local: {
        get: async () => storage, set: async values => Object.assign(storage, plain(values)),
      } } } },
    }).default
    const backup = await settings.exportSettings()
    storage.uiLanguage = 'auto'
    await settings.importSettingsInBackground(backup)
    assert.equal(storage.uiLanguage, uiLanguage)
  }
})
