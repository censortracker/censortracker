const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const { validateSettings } = load('background/settings-data')
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
const proxy = { id: 'old_proxy', name: 'My proxy', protocol: 'https://',
  uri: 'ПРИМЕР.РФ:443', credentials: 'a%40b:p%3Aa:ss' }
const backup = { useProxy: false, useOwnProxy: true, customProxies: [proxy],
  proxyChain: ['old_proxy', 'builtin'], proxyAllTraffic: true }

test('fork backup converts proxy IDs, protocols, credentials and ordered selections', () => {
  const result = plain(validateSettings({ ...backup, customProxies: [proxy,
    { id: 'socks', protocol: 'SOCKS', uri: '[2001:4860::8888]:1080', credentials: 'user:100%' },
  ], proxyChain: ['socks', 'builtin', 'old_proxy', 'socks'],
  customProxiedDomains: ['ПРИМЕР.РФ'], ignoredHosts: ['local.example'],
  siteCountryRules: { 'example.co.uk': ['RU'] },
  proxyStatuses: { old_proxy: { exitCountry: 'US' } }, domains: ['untrusted.example'],
  proxyServerURI: 'untrusted.example:443', localProxyURI: 'untrusted.example:1080',
  }))
  assert.deepEqual(result.proxies, [
    { id: 'fork-0', name: 'My proxy', protocol: 'HTTPS', host: 'xn--e1afmkfd.xn--p1ai', port: 443,
      username: 'a@b', password: 'p:a:ss' },
    { id: 'fork-1', name: 'SOCKS5 [2001:4860::8888]:1080', protocol: 'SOCKS5',
      host: '[2001:4860::8888]', port: 1080, username: 'user', password: '100%' },
  ])
  assert.deepEqual(result.selectedProxyIds, ['fork-1', 'builtin', 'fork-0'])
  assert.equal(result.proxyAll, true)
  assert.equal(result.useProxy, false)
  assert.deepEqual(result.customProxiedDomains, ['xn--e1afmkfd.xn--p1ai'])
  assert.deepEqual(result.siteCountryRules, { 'example.co.uk': ['RU'] })
  for (const key of ['proxyStatuses', 'domains', 'proxyServerURI', 'localProxyURI', 'customProxies']) {
    assert.equal(Object.hasOwn(result, key), false)
  }
})

test('fork selections preserve disabled custom mode, empty pools and legacy backups', () => {
  const selection = input => plain(validateSettings(plain(input))).selectedProxyIds
  assert.deepEqual(selection({ ...backup, useOwnProxy: false }), ['builtin'])
  assert.deepEqual(selection({ ...backup, useOwnProxy: undefined }), ['builtin'])
  assert.deepEqual(selection({ ...backup, proxyChain: [] }), [])
  assert.deepEqual(selection({ ...backup, proxyChain: null, activeCustomProxyId: 'old_proxy' }), ['fork-0'])
  assert.deepEqual(selection({ ...backup, customProxies: [], proxyChain: [] }), [])
  const legacy = { useOwnProxy: true, customProxies: [], proxyChain: null,
    customProxyProtocol: 'SOCKS', customProxyServerURI: 'legacy.example:1080' }
  assert.equal(validateSettings(legacy).proxies[0].protocol, 'SOCKS5')
  assert.deepEqual(selection(legacy), ['legacy'])
  // Original backups keep their original SOCKS4 meaning.
  assert.equal(validateSettings({ customProxyProtocol: 'SOCKS', customProxyServerURI: 'legacy.example:1080' }).proxies[0].protocol, 'SOCKS4')
  const restricted = validateSettings({ ...backup, customProxies: [{ ...proxy, restricted: true }] })
  assert.equal(restricted.proxies[0].restricted, true)
})

test('fork backups restore source URLs and recovery without importing source caches', async () => {
  const storage = { domains: ['trusted.example'], proxyChecks: { trusted: true } }
  let writes = 0
  const settings = loadSettings({
    'browser-api': { default: { storage: { local: {
      get: async () => storage,
      set: async values => { writes++; Object.assign(storage, plain(values)) },
    } } } },
  }).default
  const input = { ...backup, proxySources: ['https://list.example', 'https://list.example/'],
    proxySourcesEnabled: true, proxySubscriptionsEnabled: true, proxyRecoveryEnabled: true,
    useCustomRegistry: true, customRegistryUrl: 'https://registry.example/list',
    useExternalBlocklist: true, externalBlocklistDomains: ['untrusted.example'],
    proxyChecks: { forged: true }, useLocalProxy: true, localProxyURI: 'evil.example:80' }
  await settings.importSettingsInBackground(input)
  assert.equal(writes, 1)
  assert.deepEqual(storage.registrySource, { kind: 'custom', url: 'https://registry.example/list', enabled: false, autoUpdate: false })
  assert.deepEqual(storage.proxySubscriptions, [{ id: 'fork-source-0', url: 'https://list.example/', protocol: 'HTTPS' }])
  assert.equal(storage.proxySubscriptionsEnabled, false)
  assert.equal(storage.proxyRecoveryEnabled, true)
  assert.equal(storage.localProxyURI, null)
  assert.equal(storage.localProxyAlive, false)
  assert.deepEqual(storage.domains, ['trusted.example'])
  assert.deepEqual(storage.proxyChecks, { trusted: true })
  assert.equal(storage.externalBlocklistDomains, undefined)
  assert.equal(validateSettings({ useExternalBlocklist: true }).registrySource.kind, 'anticensority')
  assert.equal(validateSettings({ useExternalBlocklist: true, customRegistryUrl: '' }).registrySource.kind, 'anticensority')
  const externalOnly = validateSettings({ useExternalBlocklist: true,
    useCustomRegistry: false, customRegistryUrl: 'https://old.example/registry' }).registrySource
  assert.equal(externalOnly.kind, 'anticensority')
  assert.equal(externalOnly.enabled || externalOnly.autoUpdate, false)
  const exported = plain(await settings.exportSettings())
  assert.equal(exported.formatVersion, 1)
  assert.deepEqual(plain(validateSettings(exported)).proxies, storage.proxies)
  assert.deepEqual(plain(validateSettings(exported)).selectedProxyIds, storage.selectedProxyIds)
})

test('canonical and versioned settings ignore stale fork keys', () => {
  const canonical = plain(validateSettings(backup))
  assert.deepEqual(plain(validateSettings({ ...backup, ...canonical,
    customProxies: 'stale', proxyChain: ['missing'], proxyAllTraffic: false,
  })), canonical)
  assert.deepEqual(plain(validateSettings({ formatVersion: 1, settings: {
    ...canonical, customProxies: 'stale', proxyChain: ['missing'],
  } })), canonical)
})

test('invalid fork backups reject the whole import before a write', async () => {
  let writes = 0
  const settings = loadSettings({
    'browser-api': { default: { storage: { local: { set: async () => { writes++ } } } } },
  }).default
  const invalid = [
    { customProxies: null }, { customProxies: [null] },
    { customProxies: Array(5001).fill(proxy) }, { proxyChain: 'old_proxy' },
    { proxyChain: ['missing'] }, { activeCustomProxyId: 1 },
    { proxyChain: null, activeCustomProxyId: 'missing' }, { proxyAllTraffic: 'true' },
    { useCustomRegistry: 1 }, { useExternalBlocklist: 'true' },
    { customRegistryUrl: 'javascript:alert(1)' }, { customRegistryUrl: null },
    { proxySources: ['https://user:password@example.com/list'] }, { proxySources: 'https://list.example/' },
    { proxySources: Array(21).fill('https://list.example/') },
    ...[{ id: 'builtin' }, { id: '__proto__()' }, { protocol: 'DIRECT' },
      { uri: 'host:80; DIRECT' }, { uri: "host:80'; alert(1); '" },
      { uri: 'host:0' }, { uri: 'user:pass@host:80' }, { credentials: 1 },
      { credentials: 'a:%0Ab' }, { credentials: 'a%3Ab:secret' },
      { credentials: 'a:' + 'x'.repeat(1025) }, { restricted: 'true' }, { name: 0 },
    ].map(change => ({ customProxies: [{ ...proxy, ...change }] })),
    { customProxies: [proxy, proxy] },
    { customProxies: [proxy, { ...proxy, id: 'other', credentials: 'another:login' }] },
  ]
  for (const change of invalid) {
    await assert.rejects(settings.importSettingsInBackground({ ...backup, ...change }))
  }
  assert.equal(writes, 0)
})
