// Deterministic browser APIs for screenshot tests. No network services are used.
module.exports = function visualFixture({ language, scenario, firefox, messages }) {
  const timestamp = 1712345678000
  const NativeDate = Date
  window.Date = class extends NativeDate {
    constructor(...args) { super(...(args.length ? args : [timestamp])) }
    static now() { return timestamp }
  }
  const event = () => {
    const listeners = new Set()
    return {
      addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn),
      emit: (...args) => { for (const fn of listeners) fn(...args) },
    }
  }
  const changed = event()
  const proxy = { id: 'custom', name: 'Test proxy', protocol: 'HTTP', host: 'proxy.example', port: 8080 }
  const source = { kind: 'custom', url: 'https://registry.example/list', enabled: true, autoUpdate: false }
  const warning = scenario === 'warnings'
  const paused = scenario === 'paused'
  const state = {
    uiLanguage: language, dataConsent: { version: 1, accepted: !paused },
    enableExtension: scenario !== 'disabled', useProxy: true, useRegistry: true,
    showNotifications: true, proxyIsAlive: !warning, proxyRecoveryEnabled: false,
    currentRegionName: 'Russia', currentRegionCode: 'RU', registryRegionCode: 'RU',
    domains: ['example.com'], customProxiedDomains: ['alpha.example', 'beta.example'], ignoredHosts: ['ignored.example'],
    proxyServerURI: 'managed.example:443', proxies: [proxy], selectedProxyIds: ['builtin', 'custom'],
    proxyChecks: { custom: { status: 'ok', latency: 42, checkedAt: timestamp, serverCountry: 'DE', exitCountry: 'US', exitIP: '192.0.2.1' } },
    proxyCheckRun: { running: false }, registrySource: source, externalRegistry: null,
    siteCountryRules: { 'example.com': ['RU', 'CN'] }, proxySubscriptions: [], proxySubscriptionsEnabled: false,
    useLocalProxy: scenario === 'local', localProxyAlive: false, proxyAll: false,
    updateAvailable: warning, backendIsIntermittent: warning,
    'noticeActive:release-21': true, 'noticeRead:release-21': scenario !== 'notice',
    disseminators: warning ? [{ url: 'example.com', name: 'Example', cooperationRefused: false }] : [],
  }
  const storage = {
    async get(keys) {
      await new Promise(resolve => setTimeout(resolve, 0))
      if (keys == null) return { ...state }
      if (typeof keys === 'string') keys = [keys]
      if (Array.isArray(keys)) return Object.fromEntries(keys.filter(key => key in state).map(key => [key, state[key]]))
      return Object.fromEntries(Object.entries(keys).map(([key, fallback]) => [key, key in state ? state[key] : fallback]))
    },
    async set(values) {
      const changes = Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { oldValue: state[key], newValue }]))
      Object.assign(state, values)
      changed.emit(changes, 'local')
    },
    async clear() { for (const key of Object.keys(state)) delete state[key] },
    async remove(keys) { for (const key of [].concat(keys)) delete state[key] },
  }
  const conflict = scenario.startsWith('conflict')
  const tab = { id: 1, windowId: 1, url: scenario === 'tor' ? 'http://example.onion/' : scenario === 'i2p' ? 'http://example.i2p/' : 'https://example.com/' }
  const rpc = async ({ action, args }) => {
    await new Promise(resolve => setTimeout(resolve, 0))
    if (scenario === 'error' && ['setDataConsent', 'synchronize', 'updateRegistry', 'updateRegistrySource', 'importProxies', 'startProxyChecks'].includes(action)) {
      return { error: 'Fixture failure' }
    }
    let value
    switch (action) {
      case 'dataConsent': value = state.dataConsent; break
      case 'setDataConsent': await storage.set({ dataConsent: { version: 1, accepted: args } }); break
      case 'registryStatus': value = { state: warning ? 'unavailable' : 'ready', skipped: warning ? 2 : 0, error: warning ? 'Fixture failure' : '' }; break
      case 'registryEmpty': value = warning; break
      case 'domainStatus': value = { blocked: warning, custom: false, ignored: false }; break
      case 'registrySourceState':
      case 'updateRegistrySource':
      case 'refreshRegistrySource': value = { source, count: 25, updatedAt: timestamp }; break
      case 'proxies': value = { builtin: { id: 'builtin', name: 'Censor Tracker', protocol: 'HTTPS' }, proxies: state.proxies, selectedProxyIds: state.selectedProxyIds }; break
      case 'proxyCheckState': value = { checks: state.proxyChecks, run: state.proxyCheckRun }; break
      case 'subscriptions': value = { proxySubscriptions: [], proxySubscriptionsEnabled: false }; break
      case 'proxyRouteInfo': value = { type: 'proxy', proxy, check: state.proxyChecks.custom, fallbackCount: 1, domainCount: 25, region: 'Russia', regionCode: 'RU' }; break
      case 'diagnosticInfo': value = { version: '21.0.0', browser: 'Fixture', consent: true }; break
      case 'findRelatedDomains': value = ['cdn.example.com', 'api.example.com']; break
      case 'syncLocalProxy': value = { alive: false }; break
      case 'synchronize':
      case 'removeProxy':
      case 'ping': break
      case 'setProxy': value = true; break
      case 'updateRegistry': break
      case 'incognitoAccess': value = { allowed: scenario !== 'permission', restore: false }; break
      case 'proxyControl': value = { controlled: conflict, extensions: conflict ? await api.management.getAll() : [] }; break
      case 'notices': value = state['noticeActive:release-21'] && !state['noticeRead:release-21']
        ? [{ id: 'release-21', title: 'release21Title', text: 'release21Text', link: { label: 'noticeSupport', path: 'options.html#contacts' } }] : []; break
      case 'popupState': {
        const enabled = state.enableExtension, proxying = state.useProxy, alive = state.proxyIsAlive
        const hostname = new URL(tab.url).hostname
        value = !state.dataConsent.accepted ? { consent: false } : {
          consent: true, url: tab.url, tabId: tab.id, hostname, valid: true, proxying, enabled,
          useLocalProxy: state.useLocalProxy, localProxyAlive: state.localProxyAlive, backendIsIntermittent: state.backendIsIntermittent,
          alive, connectionIssues: proxying && !alive && !state.useLocalProxy && !(firefox && scenario === 'permission'),
          domain: enabled ? { blocked: warning, custom: false, ignored: false } : null,
          disseminator: enabled && state.disseminators.find(({ url }) => url === hostname) || {},
          controlled: !firefox && conflict, highlight: warning, choice: 'auto',
          network: ['tor', 'i2p'].includes(scenario) ? scenario : '',
        }
        break
      }
      default: throw new Error('Missing visual RPC fixture: ' + action)
    }
    return { value }
  }
  const api = {
    storage: { local: storage, onChanged: changed },
    runtime: {
      id: 'visual-fixture', getURL: path => new URL(path, location.origin).href,
      getManifest: () => ({ name: 'Censor Tracker', version: '21.0.0' }),
      ...(firefox ? { getBrowserInfo: async () => ({ name: 'Firefox', version: '140.17.0' }) } : {}),
      sendMessage: rpc, onMessage: event(), reload() {},
    },
    i18n: {
      getUILanguage: () => language,
      getMessage(key, values = []) {
        const entry = messages[key]
        if (!entry) return ''
        return entry.message.replace(/\$(\d+)/g, (_, n) => [].concat(values)[n - 1] || '')
      },
    },
    tabs: { query: async () => [tab], create: async () => tab, update: async () => tab, remove: async () => {}, reload: async () => {}, get: async () => tab },
    windows: { getCurrent: async () => ({ id: 1, incognito: false }), update: async () => {} },
    extension: { isAllowedIncognitoAccess: async () => scenario !== 'permission' },
    browserAction: { setBadgeText: async () => {} },
    proxy: { settings: { get: async () => ({ value: {}, levelOfControl: conflict ? 'controlled_by_other_extensions' : 'controlled_by_this_extension' }), set: async () => {}, clear: async () => {}, onChange: event() } },
    management: {
      getSelf: async () => ({ id: 'self', name: 'Censor Tracker' }),
      getAll: async () => Array.from({ length: scenario === 'conflicts' ? 2 : 1 }, (_, n) => ({ id: String(n), name: 'Example extension ' + (n + 1), permissions: ['proxy'] })),
      setEnabled: async () => {},
    },
    notifications: { create: async () => {} },
  }
  window.chrome = api
  if (firefox) window.browser = api
  window.visual = { state, storage }
  if (location.pathname.endsWith('/animation.html')) {
    Object.defineProperty(performance, 'now', { value: () => 0 })
    window.requestAnimationFrame = callback => setTimeout(() => callback(3000), 16)
    window.cancelAnimationFrame = clearTimeout
  }
}
