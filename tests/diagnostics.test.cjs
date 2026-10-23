const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const { currentProxyCheck, proxyFingerprint } = load('background/proxy-check-data')
const { registrySourceKey } = load('background/registry-source-data')
const { validateSettings } = load('background/settings-data')
const plain = value => JSON.parse(JSON.stringify(value))

async function fixture() {
  const proxy = { id: 'one', name: 'Private proxy name', protocol: 'HTTP',
    host: 'proxy.example', port: 8080, username: 'alice', password: 'secret-password' }
  const source = { kind: 'custom', url: 'https://registry.example/private-token?key=query-token#fragment-token',
    enabled: true, autoUpdate: true }
  const storage = { proxies: [proxy], selectedProxyIds: ['one', 'builtin'],
    enableExtension: true, useProxy: true, proxyRecoveryEnabled: true,
    proxyServerURI: 'builtin.example:443', domains: ['cached.example'],
    ignoredHosts: ['private.example'], customProxiedDomains: ['personal.example'],
    siteCountryRules: { 'rule.example': ['RU'] },
    proxySubscriptions: [{ id: 'source', url: 'https://subscription.example/secret-path?key=subscription-token', protocol: 'HTTP' }],
    registrySource: source, externalRegistry: { source: registrySourceKey(source),
      domains: ['external.example'], updatedAt: 200 },
    registryCache: { primary: ['primary.example'], custom: ['custom.example'], backend: ['backend.example'], updatedAt: 100 },
    antizapret: { domains: ['provider.example'] },
    localConfig: { countryCode: 'BY', customRegistryUrl: source.url, ignoredHosts: ['private.example'] },
    serviceErrors: ['Request failed: https://alice:secret-password@registry.example/private-token?key=query-token'],
    proxySetupError: 'Auth failed for alice: secret-password on sub.private.example and rule.example', proxyLastFetchTs: 300,
    fallbackProxyInUse: true, fallbackReason: 'Connection failed',
    proxyChecks: { one: { fingerprint: await proxyFingerprint(proxy), status: 'ok',
      checkedAt: 400, latency: 25, exitCountry: 'US', serverCountry: 'DE', exitIP: '8.8.8.8' } },
    proxyFailures: { one: { fingerprint: await proxyFingerprint(proxy), retryAt: Date.now() + 60000 } },
    proxyCheckRun: { running: false, completed: 1, total: 1 },
  }
  const browser = {
    isFirefox: true,
    storage: { local: { get: async defaults => ({ ...defaults, ...storage }),
      set: () => { throw new Error('Diagnostics must not write storage') } } },
    runtime: { getManifest: () => ({ version: '20.0.0', manifest_version: 2 }),
      getPlatformInfo: async () => ({ os: 'linux', arch: 'x86-64' }) },
    extension: { isAllowedIncognitoAccess: async () => true },
    management: { getSelf: async () => ({ id: 'self' }), getAll: async () => [
      { id: 'self', name: 'Censor Tracker', enabled: true, permissions: ['proxy'] },
      { id: 'other', name: 'Other proxy', version: '1.2', enabled: true, permissions: ['proxy'] },
      { id: 'inactive', enabled: false, permissions: ['proxy'] },
    ] },
    proxy: { settings: { get: async () => ({ levelOfControl: 'controlled_by_other_extensions',
      value: { pacScript: { data: 'secret-script' } } }) } },
    alarms: { getAll: async () => [{ name: 'proxy-recovery', scheduledTime: 500, periodInMinutes: 5 }] },
  }
  const api = load('background/diagnostics', {
    'browser-api': { default: browser, getDetailedBrowserInfo: async () => ({ name: 'Firefox', version: '142.0.1' }) },
    'proxy-route': {},
    proxy: { default: {
      getSelectedProxies: async () => storage.useLocalProxy ? [] : [{
        ...storage.proxies[0], retryAt: (await currentProxyCheck(
          storage.proxies[0], storage.proxyFailures))?.retryAt || 0,
      }],
      getProxyingRules: async () => ({}),
    } },
    registry: { default: { getDomainCount: async () => 4,
      getStatus: async () => ({ state: 'ready', skipped: 0, error: '' }) } },
  }, { fetch: () => { throw new Error('Diagnostics must not request the network') } })
  return { ...api, storage, browser }
}

test('diagnostics report modes, ordered selection, checks, counts and scheduled tasks without secrets', async () => {
  const state = await fixture()
  const report = plain(await state.getDiagnosticInfo())
  assert.equal(report.reportType, 'censortracker-diagnostics')
  assert.equal(new Date(report.generatedAt).toISOString(), report.generatedAt)
  assert.deepEqual(report.browser, { name: 'Firefox', version: '142.0.1' })
  assert.deepEqual(report.platform, { os: 'linux', arch: 'x86-64' })
  assert.equal(report.incognitoAllowed, true)
  assert.equal(report.modes.proxyRecoveryEnabled, true)
  assert.deepEqual(report.selectedProxyIds, ['one', 'builtin'])
  assert.equal(report.proxies[1].hasAuth, true)
  assert.equal(report.proxies[1].available, false)
  assert.equal(report.proxies[1].retryAt, state.storage.proxyFailures.one.retryAt)
  assert.deepEqual(report.proxies[1].check, { status: 'ok', checkedAt: 400, latency: 25, exitCountry: 'US', serverCountry: 'DE' })
  assert.equal(report.registry.domainCount, 4)
  for (const key of ['builtinCount', 'primaryCount', 'customCount', 'backendCount', 'providerCount']) {
    assert.equal(report.registry[key], 1)
  }
  assert.equal(report.registry.updatedAt, 100)
  assert.deepEqual(report.registry.external, { kind: 'custom', enabled: true, autoUpdate: true, count: 1, updatedAt: 200 })
  assert.deepEqual(report.rules, { ignoredHostCount: 1, customProxiedDomainCount: 1, siteCountryRuleCount: 1, subscriptionCount: 1 })
  assert.deepEqual(report.alarms, [{ name: 'proxy-recovery', scheduledTime: 500, periodInMinutes: 5 }])
  assert.equal(report.proxyLevelOfControl, 'controlled_by_other_extensions')
  assert.equal(report.proxyControlled, false)
  assert.deepEqual(report.conflictingExtensions, [{ name: 'Other proxy', version: '1.2' }])
  assert.equal(report.fallbackProxyInUse, true)
  assert.equal(report.proxyLastFetchTs, 300)
  assert.doesNotMatch(JSON.stringify(report), /alice|secret-password|private-token|query-token|fragment-token|secret-path|subscription-token|private\.example|personal\.example|rule\.example|cached\.example|external\.example|secret-script|fingerprint|8\.8\.8\.8/)
  assert.throws(() => validateSettings(report), /Invalid settings format/)
})

test('diagnostics omit stale checks and external caches, and show unavailable local proxy selection', async () => {
  const state = await fixture()
  state.storage.proxies[0].password = 'changed-password'
  state.storage.registrySource.url = 'https://new.example/list'
  state.storage.antizapret = null
  state.storage.registryCache = null
  let report = plain(await state.getDiagnosticInfo())
  assert.equal(report.proxies[1].check, null)
  assert.equal(report.proxies[1].retryAt, null)
  assert.equal(report.proxies[1].available, true)
  assert.equal(report.registry.external.count, 0)
  assert.equal(report.registry.external.updatedAt, null)
  state.storage.useLocalProxy = true
  report = plain(await state.getDiagnosticInfo())
  assert.deepEqual(report.selectedProxyIds, ['local'])
  assert.deepEqual(report.configuredSelectedProxyIds, ['one', 'builtin'])
  assert.equal(report.proxies.at(-1).id, 'local')
  assert.equal(report.proxies.at(-1).available, false)
  assert.equal(report.localProxyAlive, false)
})

test('missing optional browser APIs do not prevent a diagnostic report', async () => {
  const state = await fixture()
  delete state.browser.management
  delete state.browser.extension
  delete state.browser.alarms
  delete state.browser.runtime.getPlatformInfo
  state.browser.proxy.settings.get = async () => { throw new Error('Unavailable') }
  const report = await state.getDiagnosticInfo()
  for (const key of ['platform', 'incognitoAllowed', 'alarms', 'proxyLevelOfControl', 'conflictingExtensions']) {
    assert.equal(report[key], null)
  }
})

test('mirror diagnostics show attempt and update times and redact error URLs', async () => {
  const state = await fixture()
  assert.deepEqual(plain((await state.getDiagnosticInfo()).mirrors), {
    checkedAt: null, updatedAt: null, error: '',
  })
  Object.assign(state.storage, { mirrorsCheckedAt: 600, mirrorsUpdatedAt: 500,
    mirrorsError: 'HTTP 404: https://alice:secret-password@api.example/private-token' })
  assert.deepEqual(plain((await state.getDiagnosticInfo()).mirrors), {
    checkedAt: 600, updatedAt: 500, error: 'HTTP 404: [URL]',
  })
})

test('browser information uses full browser-specific versions', () => {
  for (const [userAgent, name, version] of [
    ['Firefox/142.0.1', 'Firefox', '142.0.1'],
    ['Chrome/142.0.1.2', 'Chrome', '142.0.1.2'],
    ['Chrome/142.0.0.0 Edg/142.0.2.3', 'Microsoft Edge', '142.0.2.3'],
    ['Chrome/142.0.0.0 OPR/120.0.1.2', 'Opera', '120.0.1.2'],
    ['Chrome/142.0.0.0 YaBrowser/25.10.1.2', 'Yandex Browser', '25.10.1.2'],
  ]) {
    const { getBrowserInfo } = load('background/browser-api', {}, { chrome: {}, navigator: { userAgent } })
    assert.deepEqual(plain(getBrowserInfo()), { name, version })
  }
})

test('browser versions use native information when the user agent is reduced', async () => {
  const navigator = { userAgent: 'Chrome/142.0.0.0', userAgentData: {
    getHighEntropyValues: async () => ({ fullVersionList: [{ brand: 'Google Chrome', version: '142.0.7444.1' }] }),
  } }
  const chromeInfo = load('background/browser-api', {}, { chrome: {}, navigator })
  assert.equal((await chromeInfo.getDetailedBrowserInfo()).version, '142.0.7444.1')
  delete navigator.userAgentData
  assert.equal((await chromeInfo.getDetailedBrowserInfo()).version, '142.0.0.0')
  const firefoxInfo = load('background/browser-api', {}, { navigator: { userAgent: 'Firefox/142.0' },
    browser: { runtime: { getBrowserInfo: async () => ({ name: 'Firefox', version: '142.0.1', buildID: 'private' }) } },
  })
  assert.deepEqual(plain(await firefoxInfo.getDetailedBrowserInfo()), { name: 'Firefox', version: '142.0.1' })
})

test('diagnostic reports include only safe attempt details for managed and custom proxies', async () => {
  const state = await fixture()
  const builtin = { id: 'builtin', protocol: 'HTTPS', host: 'builtin.example', port: 443 }
  state.storage.proxyChecks.builtin = { status: 'failed', fingerprint: await proxyFingerprint(builtin),
    attempts: [{ service: 'api.ipify.org', code: 'network', netError: 'net::ERR_TIMED_OUT', password: 'do-not-export' }] }
  state.storage.proxyChecks.one.attempts = [{ service: 'api.myip.com', code: 'ok', headers: { cookie: 'do-not-export' } }]
  const report = plain(await state.getDiagnosticInfo())
  assert.equal(report.proxies[0].check.attempts[0].netError, 'net::ERR_TIMED_OUT')
  assert.deepEqual(report.proxies[1].check.attempts, [{ service: 'api.myip.com', code: 'ok' }])
  assert.equal(JSON.stringify(report).includes('do-not-export'), false)
})
