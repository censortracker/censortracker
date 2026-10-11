const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const babel = require('@babel/core')
const loadUI = require('./load.cjs')
const loadOperations = (mocks) => loadUI('../ui/pages/settings-operations', {
  'background-rpc': {}, settings: {}, proxy: {}, server: {},
  'browser-api': {}, i18n: { getMessage: key => key }, ...mocks,
})

const root = path.resolve(__dirname, '../src/shared/js/background')
const clone = value => JSON.parse(JSON.stringify(value))
const normalPac = 'function FindProxyForURL(url, host) { return "HTTPS normal.example:443"; }'

function fixture(options = {}) {
  const storage = { dataConsent: { version: 1, accepted: true }, enableExtension: true, useProxy: true, proxyServerURI: 'normal.example:443', ...options.storage }
  const original = options.value || (options.firefox
    ? { proxyType: 'autoConfig', autoConfigUrl: 'data:text/plain,' + encodeURIComponent(normalPac) }
    : { mode: 'pac_script', pacScript: { data: normalPac } })
  let settings = { value: original, levelOfControl: options.control || 'controlled_by_this_extension' }
  const listeners = new Set()
  const routeListeners = new Set()
  const headerListeners = new Set()
  const events = []
  const browser = {
    runtime: { getURL: (path = '') => `${options.firefox ? 'moz' : 'chrome'}-extension://test/${path}` },
    webRequest: { onHeadersReceived: {
      addListener: fn => headerListeners.add(fn), removeListener: fn => headerListeners.delete(fn),
    } },
    alarms: { create() {} },
    isFirefox: !!options.firefox,
    extension: { isAllowedIncognitoAccess: async () => options.privateAllowed !== false },
    browserAction: { setBadgeText: async () => {} },
    storage: {
      local: {
        get: async keys => {
          if (typeof keys === 'string') return { [keys]: storage[keys] }
          if (Array.isArray(keys)) return Object.fromEntries(keys.map(key => [key, storage[key]]))
          return { ...keys, ...storage }
        },
        set: async values => Object.assign(storage, clone(values)),
        remove: async keys => { for (const key of [].concat(keys)) delete storage[key] },
      },
      onChanged: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) },
    },
    proxy: { settings: {
      onChange: { addListener: fn => routeListeners.add(fn), removeListener: fn => routeListeners.delete(fn) },
      get: async () => clone(settings),
      set: async ({ value }) => {
        events.push('set')
        settings = { value: clone(value), levelOfControl: 'controlled_by_this_extension' }
      },
      clear: async () => {
        events.push('clear')
        settings = { value: options.inherited || { mode: 'direct' }, levelOfControl: 'controllable_by_this_extension' }
      },
    } },
  }
  const mocks = {
    'browser-api': { default: browser },
    localproxy: { default: { ping: async () => null } },
    proxy: { default: {
      setProxy: async () => events.push('refresh'),
      pingInBackground: async () => events.push('knock'),
      getProxyingRules: async () => options.noProxy ? {} : {
        proxyServerURI: 'retry.example:443', proxyServerProtocol: options.protocol || 'HTTPS',
      },
      getServiceProxyRoute: async hostname => {
        const { routingConfig, createRouter } = load('routing')
        const config = routingConfig({ domains: [hostname],
          ignoredHosts: storage.ignoredHosts || [], siteCountryRules: storage.siteCountryRules || {},
          proxies: options.noProxy ? [] : options.proxies || [{ id: 'retry', protocol: options.protocol || 'HTTPS', host: 'retry.example', port: 443 }],
        })
        return createRouter(config, load('host-match').findHostMatch, load('private-host').isPrivateHost)(hostname)
      },
    } },
    'background-rpc': { callBackground: () => { throw new Error('Unexpected RPC') } },
    ...options.mocks,
  }
  const modules = {}
  const route = host => {
    const value = settings.value
    const script = options.firefox
      ? decodeURIComponent(value.autoConfigUrl.split(',').slice(1).join(','))
      : value.pacScript.data
    const scope = {}
    vm.runInNewContext(script, scope)
    return scope.FindProxyForURL('https://' + host, host)
  }
  function load(name) {
    if (name.endsWith('.json')) return require(path.resolve(root, name))
    name = path.basename(name).replace(/\.[jt]s$/, '')
    if (mocks[name]) return { __esModule: true, ...mocks[name] }
    if (modules[name]) return modules[name].exports
    const module = { exports: {} }
    modules[name] = module
    const source = babel.transformSync(fs.readFileSync(path.join(root, name + '.ts'), 'utf8'), {
      configFile: false, babelrc: false, filename: name + '.ts',
      presets: ['@babel/preset-typescript'],
      plugins: ['@babel/plugin-transform-modules-commonjs'],
    }).code
    vm.runInNewContext(source, {
      module, exports: module.exports, require: load,
      URL, AbortController, TextEncoder, performance, crypto: require('node:crypto').webcrypto, console: { warn() {}, info() {}, error() {}, group() {}, groupEnd() {}, log() {}, table() {} },
      setTimeout: (fn, delay) => setTimeout(fn, options.fastTimeout ? 5 : delay), clearTimeout,
      fetch: async (url, init) => {
        if (url.startsWith('data:')) return { text: async () => decodeURIComponent(url.split(',').slice(1).join(',')) }
        events.push('fetch')
        return options.fetch(url, init, { route, storage, listeners })
      },
    }, { filename: name + '.ts' })
    return module.exports
  }
  return { load, storage, events, route, original, settings: () => settings, listeners, routeListeners, headerListeners, browser }
}

const response = data => ({ ok: true, json: async () => data })

for (const firefox of [false, true]) {
  test(`all core APIs use added mirrors after built-in failures and restore routes: Firefox=${firefox}`, async () => {
    const mirrors = {
      geoip: ['https://geo.mirror.example/iso'], proxyList: ['https://proxy.mirror.example/list'],
      config: ['https://config.mirror.example/{country}/'], domains: ['https://domains.mirror.example/{country}/'],
      ori: ['https://ori.mirror.example/list'], registry: { BY: ['https://registry.mirror.example/by.json'] },
    }
    const custom = 'https://custom.example/registry'
    const payloads = {
      'https://geo.mirror.example/iso': { countryCode: 'BY' },
      'https://proxy.mirror.example/list': [{ server: 'managed.example', port: 443,
        pingHost: 'knock.example', pingPort: 8443, active: true, weight: 1 }],
      'https://config.mirror.example/BY/': { customRegistryUrl: custom },
      'https://domains.mirror.example/BY/': ['backend.example'],
      'https://ori.mirror.example/list': [{ url: 'ori.example', cooperationRefused: true }],
      'https://registry.mirror.example/by.json': ['primary.example'],
      [custom]: [{ domains: ['custom.example'] }],
    }
    const urls = []
    const state = fixture({ firefox, storage: { serviceMirrors: mirrors },
      fetch: async (url, init, { route }) => {
        urls.push(url)
        assert.equal(route('other.example'), 'HTTPS normal.example:443')
        assert.equal(init.redirect, url.includes('/api/domains/') || url.includes('domains.mirror') ? 'manual' : 'error')
        if (!(url in payloads)) throw new Error('Built-in endpoint is offline')
        assert.equal(route(new URL(url).hostname), 'DIRECT')
        return response(payloads[url])
      },
    })
    await state.load('server').synchronizeInBackground()
    assert.deepEqual(urls, [
      ...Array(2).fill('https://cozyquokka.net/api/proxy-list/'), 'https://proxy.mirror.example/list',
      'https://geo.ctreserve.de/get-iso/', 'https://geo.mirror.example/iso',
      ...Array(2).fill('https://censortracker.github.io/ctconf/registry/by.json'), 'https://registry.mirror.example/by.json',
      ...Array(2).fill('https://cozyquokka.net/api/config/BY/'), 'https://config.mirror.example/BY/', custom,
      ...Array(2).fill('https://cozyquokka.net/api/domains/BY/'), 'https://domains.mirror.example/BY/',
      ...Array(2).fill('https://registry.ctreserve.de/api/v3/disseminators/refused/'), 'https://ori.mirror.example/list',
    ])
    assert.equal(state.storage.localConfig.countryCode, 'BY')
    assert.equal(state.storage.geoIPStatus, 'direct')
    assert.deepEqual(state.storage.domains, ['primary.example', 'custom.example', 'backend.example'])
    assert.deepEqual(state.storage.disseminators, payloads['https://ori.mirror.example/list'])
    assert.deepEqual(state.storage.serviceErrors, [])
    assert.equal(state.storage.serviceRouteSnapshot, undefined)
    assert.equal(state.route('other.example'), 'HTTPS normal.example:443')
  })

  test(`a queued mirror download does not fetch after extension disablement: Firefox=${firefox}`, async () => {
    let finish
    const urls = []
    const state = fixture({ firefox, fetch: async url => {
      urls.push(url)
      return new Promise(resolve => { finish = () => resolve(response([])) })
    } })
    const running = state.load('service-request').requestService('https://busy.example/', Array.isArray)
    await new Promise(setImmediate)
    const download = state.load('service-mirrors').refreshServiceMirrors()
    await new Promise(setImmediate)
    state.storage.enableExtension = false
    finish()
    await running
    await download
    assert.deepEqual(urls, ['https://busy.example/'])
    assert.equal(state.storage.serviceMirrors, undefined)
    assert.match(state.storage.mirrorsError, /Extension is disabled/)
    assert.equal(state.storage.serviceRouteSnapshot, undefined)
  })

  test(`the mirror file retries through a proxy and restores routes: Firefox=${firefox}`, async () => {
    const routes = []
    const mirrors = { ori: ['https://ori.mirror.example/list'] }
    const state = fixture({ firefox, fetch: async (url, init, { route }) => {
      assert.equal(init.redirect, 'error')
      routes.push(route(new URL(url).hostname))
      if (routes.length === 1) throw new Error('GitHub is offline directly')
      return response({ formatVersion: 1, mirrors })
    } })
    await state.load('service-mirrors').refreshServiceMirrors()
    assert.deepEqual(routes, ['DIRECT', 'HTTPS retry.example:443'])
    assert.deepEqual(state.storage.serviceMirrors, mirrors)
    assert.equal(state.storage.mirrorsError, '')
    assert.equal(state.storage.serviceRouteSnapshot, undefined)
    assert.equal(state.route('other.example'), 'HTTPS normal.example:443')
  })

  test(`the mirror file downloads with proxy use disabled: Firefox=${firefox}`, async () => {
    let calls = 0
    const value = firefox ? { proxyType: 'none' } : { mode: 'direct' }
    const state = fixture({ firefox, value, control: 'controllable_by_this_extension',
      storage: { useProxy: false },
      fetch: async () => { calls++; return response({ formatVersion: 1, mirrors: {} }) },
    })
    await state.load('service-mirrors').refreshServiceMirrors()
    assert.equal(calls, 1)
    assert.deepEqual(state.storage.serviceMirrors, {})
    assert.equal(state.storage.mirrorsError, '')
    assert.deepEqual(state.settings().value, value)
    assert.ok(!state.events.includes('knock'))
  })
}

test('a sync keeps one mirror snapshot when a new file is saved during a service request', async () => {
  const old = { registry: { BY: ['https://old.example/registry'] },
    config: ['https://old.example/config/{country}'], domains: ['https://old.example/domains/{country}'],
    ori: ['https://old.example/ori'] }
  const urls = []
  const state = fixture({ storage: { currentRegionCode: 'BY', serviceMirrors: old },
    mocks: { 'service-request': { requestService: async url => {
      urls.push(url)
      if (url.includes('proxy-list')) {
        state.storage.serviceMirrors = { ori: ['https://new.example/ori'] }
        return { data: [{ server: 'proxy.example', port: 443, pingHost: 'ping.example', pingPort: 443, active: true, weight: 1 }] }
      }
      if (!url.includes('old.example')) throw new Error('offline')
      return { data: url.includes('/config/') ? { customRegistryUrl: null } : [] }
    } } },
  })
  await state.load('server').synchronizeInBackground()
  assert.deepEqual(urls.filter(url => url.includes('old.example')), [
    'https://old.example/registry', 'https://old.example/config/BY',
    'https://old.example/domains/BY', 'https://old.example/ori',
  ])
  assert.ok(!urls.some(url => url.includes('new.example')))
  assert.deepEqual(state.storage.serviceErrors, [])
})

for (const firefox of [false, true]) {
  for (const failure of [false, 'network', 'timeout']) {
    test(`port knocks bypass proxy-all and restore routing: Firefox=${firefox}, failure=${failure}`, async () => {
      const requests = []
      const state = fixture({ firefox, fastTimeout: true,
        storage: { proxyAll: true, proxyPingURI: 'new-knock.example:8443' },
        mocks: { proxy: null, registry: { default: { getRoutingDomains: async () => [] } } },
        fetch: async (url, init, { route }) => {
          requests.push({ url, method: init.method,
            knock: route('new-knock.example'), other: route('other.example'),
            child: route('child.new-knock.example'),
            firefoxRoute: firefox ? clone(await state.load('proxy-auth').handleFirefoxProxy({ url })) : null,
          })
          if (failure === 'network') throw new Error('Knock port closed')
          if (failure === 'timeout') {
            return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('timeout'))))
          }
          return response({})
        },
      })
      await state.load('proxy-route').withProxyLock(() => state.load('proxy').default.pingInBackground())
      assert.deepEqual(requests, [{ url: 'https://new-knock.example:8443', method: 'POST',
        knock: 'DIRECT', other: 'HTTPS normal.example:443', child: 'HTTPS normal.example:443',
        firefoxRoute: null,
      }])
      assert.equal(state.route('new-knock.example'), 'HTTPS normal.example:443')
      assert.equal(state.storage.serviceRouteSnapshot, undefined)
      assert.equal(state.load('proxy-route').getServiceRoute(), null)
    })
  }
}

test('a new knock endpoint is direct before the replacement PAC is installed', async () => {
  const requests = []
  const state = fixture({ storage: { proxyAll: true, proxyPingURI: 'new-knock.example:8443' },
    mocks: { proxy: null, registry: { default: { getRoutingDomains: async () => [] } } },
    fetch: async (url, init, { route }) => { requests.push(route(new URL(url).hostname)); return response({}) },
  })
  await state.load('proxy-route').withProxyLock(() => state.load('proxy').default.setProxyInBackground())
  assert.deepEqual(requests, ['DIRECT'])
  assert.equal(state.route('new-knock.example'), 'HTTPS normal.example:443;')
  assert.equal(state.route('other.example'), 'HTTPS normal.example:443;')
  assert.equal(state.storage.serviceRouteSnapshot, undefined)
})

for (const firefox of [false, true]) {
  test(`initial proxy setup knocks after taking control from system settings: Firefox=${firefox}`, async () => {
    const requests = []
    const state = fixture({ firefox, control: 'controllable_by_this_extension',
      value: firefox ? { proxyType: 'system' } : { mode: 'system' },
      storage: { proxyAll: true, proxyPingURI: 'knock.example:8443' },
      mocks: { proxy: null, registry: { default: { getRoutingDomains: async () => [] } } },
      fetch: async (url, init, { route }) => { requests.push(route(new URL(url).hostname)); return response({}) },
    })
    await state.load('proxy-route').withProxyLock(() => state.load('proxy').default.setProxyInBackground())
    assert.deepEqual(requests, ['DIRECT'])
    assert.equal(state.storage.proxyIsAlive, true)
    assert.equal(state.storage.serviceRouteSnapshot, undefined)
  })
}

test('successful Firefox proxy setup still reads the actual private permission', async () => {
  const state = fixture({ firefox: true, privateAllowed: false,
    mocks: { proxy: null, registry: { default: { getRoutingDomains: async () => [] } } } })
  assert.equal(await state.load('proxy').default.setProxyInBackground({ ping: false }), true)
  assert.equal(state.storage.privateBrowsingPermissionsRequired, true)
})

test('disabling proxy use while the knock route is installed prevents the request', async () => {
  let requests = 0
  const state = fixture({ storage: { proxyPingURI: 'knock.example:8443' },
    mocks: { proxy: null, registry: { default: { getRoutingDomains: async () => [] } } },
    fetch: async () => { requests++; return response({}) },
  })
  const originalSet = state.browser.proxy.settings.set
  state.browser.proxy.settings.set = async args => {
    await originalSet(args)
    state.storage.useProxy = false
  }
  await state.load('proxy-route').withProxyLock(() => state.load('proxy').default.pingInBackground())
  assert.equal(requests, 0)
  assert.equal(state.settings().value.mode, 'direct')
  assert.equal(state.storage.serviceRouteSnapshot, undefined)
})

test('a periodic knock waits for the active service request and preserves forced checks', async () => {
  let release
  const pending = new Promise(resolve => { release = resolve })
  const requests = []
  const state = fixture({ storage: { proxyPingURI: 'knock.example:8443', selectedProxyIds: [] },
    mocks: { proxy: null, registry: { default: { getRoutingDomains: async () => [] } },
      'background-rpc': { callBackground: (action, force) => {
        assert.equal(action, 'ping')
        assert.equal(force, true)
        return state.load('proxy-route').withProxyLock(() => state.load('proxy').default.pingInBackground(force))
      } },
    },
    fetch: async url => {
      requests.push(url)
      if (url === 'https://service.example') await pending
      return response([])
    },
  })
  const service = state.load('service-request').requestService('https://service.example', Array.isArray)
  const knock = state.load('proxy').default.ping(true)
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(requests, ['https://service.example'])
  release()
  await Promise.all([service, knock])
  assert.deepEqual(requests, ['https://service.example', 'https://knock.example:8443'])
  assert.deepEqual(state.settings().value, state.original)
  assert.equal(state.storage.serviceRouteSnapshot, undefined)
})

test('a service proxy retry knocks directly without taking the route lock twice', async () => {
  const requests = []
  const state = fixture({ storage: { proxyAll: true, proxyPingURI: 'knock.example:8443' },
    mocks: { proxy: null, registry: { default: { getRoutingDomains: async () => [] } } },
    fetch: async (url, init, { route }) => {
      requests.push([url, route(new URL(url).hostname)])
      if (requests.length === 1) throw new Error('Service is blocked')
      return response([])
    },
  })
  await state.load('service-request').requestService('https://service.example', Array.isArray)
  assert.deepEqual(requests, [
    ['https://service.example', 'DIRECT'],
    ['https://knock.example:8443', 'DIRECT'],
    ['https://service.example', 'HTTPS normal.example:443'],
  ])
  assert.deepEqual(state.settings().value, state.original)
  assert.equal(state.storage.serviceRouteSnapshot, undefined)
})

test('a service exclusion prevents remote retries', async () => {
  let calls = 0
  const state = fixture({ storage: { ignoredHosts: ['example.com'] },
    fetch: async () => { calls++; throw new Error('offline') } })
  await assert.rejects(state.load('service-request').requestService('https://api.example.com', Array.isArray),
    /exclusion or a private host/)
  assert.equal(calls, 1)
})

test('an exclusion added during retry PAC installation prevents the request', async () => {
  let calls = 0
  const state = fixture({ fetch: async () => { calls++; throw new Error('offline') } })
  const setting = state.browser.proxy.settings
  const originalSet = setting.set
  setting.set = async args => {
    await originalSet(args)
    if (state.events.includes('knock')) state.storage.ignoredHosts = ['example.com']
  }
  await assert.rejects(state.load('service-request').requestService('https://api.example.com', Array.isArray))
  assert.equal(calls, 1)
  assert.equal(state.storage.serviceRouteSnapshot, undefined)
})

for (const firefox of [false, true]) {
  for (const host of ['192.168.1.1', '[64:ff9b:1::a00:1]', 'router.local']) {
    test(`local services never retry through a remote proxy: ${host}, Firefox=${firefox}`, async () => {
      let calls = 0
      const state = fixture({ firefox, fetch: async () => { calls++; throw new Error('offline') } })
      await assert.rejects(state.load('service-request').requestService(`http://${host}/registry.json`, Array.isArray),
        /exclusion or a private host/)
      assert.equal(calls, 1)
      assert.equal(state.storage.serviceRouteSnapshot, undefined)
    })
  }
}

for (const firefox of [false, true]) {
  test(`country-restricted services permit direct access and reject ineligible proxies, Firefox=${firefox}`, async () => {
    let calls = 0
    const blocked = 'function FindProxyForURL() { return "PROXY 127.0.0.1:0"; }'
    const value = firefox
      ? { proxyType: 'autoConfig', autoConfigUrl: 'data:text/plain,' + encodeURIComponent(blocked) }
      : { mode: 'pac_script', pacScript: { data: blocked, mandatory: true } }
    const state = fixture({ firefox, value, storage: { siteCountryRules: { 'example.com': ['RU'] } },
      fetch: async () => { calls++; throw new Error('offline') } })
    await assert.rejects(state.load('service-request').requestService('https://api.example.com', Array.isArray),
      /country rules/)
    assert.equal(calls, 1)
    assert.equal(state.route('api.example.com'), 'PROXY 127.0.0.1:0')
    assert.equal(state.storage.serviceRouteSnapshot, undefined)
  })

  test(`direct-first exact-host routing and restoration (${firefox ? 'Firefox' : 'Chrome'})`, async () => {
    const state = fixture({ firefox, fetch: async (url, init, { route }) => {
      assert.equal(route('service.example'), 'DIRECT')
      assert.equal(route('service.example.'), 'DIRECT')
      assert.equal(route('other.example'), 'HTTPS normal.example:443')
      assert.equal(route('sub.service.example'), 'HTTPS normal.example:443')
      return response([])
    } })
    await state.load('service-request').requestService('https://service.example', Array.isArray)
    if (!firefox) assert.deepEqual(state.settings().value, state.original)
    else assert.equal(state.route('service.example'), 'HTTPS normal.example:443')
    assert.equal(state.storage.serviceRouteSnapshot, undefined)
    // The routing revision listener stays registered; request listeners do not.
    assert.equal(state.listeners.size, 1)
    assert.ok(!state.events.includes('knock'))
  })
}

for (const [firefox, failure] of [false, true].flatMap(firefox =>
  ['network', 'http', 'invalid', 'json', 'timeout'].map(failure => [firefox, failure]))) {
  test(`retry after ${failure}, knock first, restore normal route: Firefox=${firefox}`, async () => {
    let calls = 0
    const state = fixture({ firefox, fastTimeout: true, fetch: async (url, init, { route }) => {
      if (++calls === 1) {
        assert.equal(route('service.example'), 'DIRECT')
        if (failure === 'network') throw new Error('network')
        if (failure === 'http') return { ok: false, status: 503 }
        if (failure === 'invalid') return response({})
        if (failure === 'json') return { ok: true, json: async () => { throw new Error('JSON') } }
        return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('timeout'))))
      }
      assert.equal(route('service.example'), 'HTTPS retry.example:443')
      assert.equal(route('other.example'), 'HTTPS normal.example:443')
      assert.ok(state.events.includes('knock'))
      return response([])
    } })
    const result = await state.load('service-request').requestService('https://service.example', Array.isArray)
    assert.equal(result.viaProxy, true)
    assert.equal(calls, 2)
    if (!firefox) assert.deepEqual(state.settings().value, state.original)
    else assert.equal(state.route('service.example'), 'HTTPS normal.example:443')
    assert.equal(state.storage.serviceRouteSnapshot, undefined)
  })
}

for (const options of [
  { noProxy: true }, { storage: { useProxy: false } },
  { storage: { enableExtension: false } }, { control: 'controlled_by_other_extensions' },
]) {
  test(`no unsafe fallback: ${JSON.stringify(options)}`, async () => {
    let calls = 0
    const state = fixture({ ...options, fetch: async () => { calls++; throw new Error('offline') } })
    await assert.rejects(state.load('service-request').requestService('https://service.example', Array.isArray))
    assert.equal(calls, 1)
    assert.ok(!state.events.includes('knock'))
    assert.equal(state.storage.serviceRouteSnapshot, undefined)
    if (options.control) assert.ok(!state.events.includes('set'))
  })
}

test('both failures restore route; pending normal PAC update runs afterward', async () => {
  const state = fixture({ fetch: async () => { throw new Error('offline') } })
  const request = state.load('service-request').requestService('https://service.example', Array.isArray)
  const next = state.load('proxy-route').withProxyLock(async () => {
    assert.equal(state.storage.serviceRouteSnapshot, undefined)
    assert.deepEqual(state.settings().value, state.original)
  })
  await assert.rejects(request)
  await next
})

test('restart restores persisted route snapshot', async () => {
  const state = fixture()
  const routes = state.load('proxy-route')
  await routes.setServiceRoute('service.example', 'HTTPS retry.example:443')
  await routes.restoreServiceRoute()
  assert.deepEqual(state.settings().value, state.original)
  assert.equal(state.storage.serviceRouteSnapshot, undefined)
})

test('disabling proxy during retry aborts request and clears override', async () => {
  let calls = 0
  const state = fixture({ fetch: async (url, init, { storage, listeners }) => {
    if (++calls === 1) throw new Error('offline')
    return new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('disabled')))
      storage.useProxy = false
      for (const listener of listeners) listener({ useProxy: { newValue: false } })
    })
  } })
  await assert.rejects(state.load('service-request').requestService('https://service.example', Array.isArray))
  assert.ok(state.events.includes('clear'))
  assert.equal(state.storage.serviceRouteSnapshot, undefined)
})

test('country mappings and validators', () => {
  const config = fixture().load('service-config')
  for (const country of ['AZ', 'BY', 'GE', 'KG', 'KZ', 'TR', 'UA', 'UZ']) {
    assert.equal(config.getRegionConfig(country).registryUrl,
      `https://censortracker.github.io/ctconf/registry/${country.toLowerCase()}.json`)
    assert.deepEqual(clone(config.getRegionConfig(country).registryMirrors), [])
  }
  assert.equal(config.getRegionConfig('PL').registryUrl, null)
  assert.deepEqual(clone(config.getRegionConfig('PL').registryMirrors), [])
  assert.match(config.getRegionConfig('RU').registryUrl, /registry.ctreserve.de/)
  assert.deepEqual(clone(config.getRegionConfig('RU').registryMirrors),
    ['https://109.61.17.39/api/v3/ct-domains/'])
  assert.equal(config.validCountry({ countryCode: 'PL' }), true)
  assert.equal(config.validCountry({ countryCode: 'invalid' }), false)
  assert.equal(config.validDomains(['example.com']), true)
  assert.equal(config.validDomains([null]), false)
  assert.equal(config.validORI([{ url: 'example.com', cooperationRefused: false }]), true)
  assert.equal(config.validORI([{}]), false)
})

for (const result of ['success', 'empty', 'network', 'invalid', 'unavailable']) {
  test(`RU registry mirror: ${result}`, async () => {
    const primary = 'https://registry.ctreserve.de/api/v3/ct-domains/'
    const mirror = 'https://109.61.17.39/api/v3/ct-domains/'
    const urls = []
    const state = fixture({ noProxy: true,
      storage: { currentRegionCode: 'RU', registryRegionCode: 'RU', domains: ['cached.example'],
        registryCache: { countryCode: 'RU', primary: ['cached.example'], custom: [], backend: [], updatedAt: 100 } },
      fetch: async url => {
        if (url.includes('/api/config/')) return response({ customRegistryUrl: null })
        if (![primary, mirror].includes(url)) return response([])
        urls.push(url)
        if (result === 'unavailable' || (url === primary && result === 'network')) {
          throw new Error('offline')
        }
        return response(url === primary && result === 'invalid' ? [null]
          : result === 'empty' ? [] : ['registry.example'])
      },
    })
    await state.load('server').synchronizeInBackground({ syncProxy: false })
    assert.deepEqual(urls, ['success', 'empty'].includes(result) ? [primary] : [primary, mirror])
    assert.deepEqual(state.storage.domains, result === 'unavailable' ? ['cached.example']
      : result === 'empty' ? [] : ['registry.example'])
    assert.equal(state.storage.registryStatus.state, result === 'unavailable' ? 'unavailable'
      : result === 'empty' ? 'empty' : 'ready')
    if (result === 'unavailable') {
      assert.equal(state.storage.registryCache.updatedAt, 100)
      assert.ok(state.storage.registryStatus.error.includes(primary))
      assert.ok(state.storage.registryStatus.error.includes(mirror))
    } else {
      assert.ok(state.storage.registryCache.updatedAt > 100)
      assert.equal(state.storage.registryStatus.error, '')
    }
    assert.equal(state.storage.serviceRouteSnapshot, undefined)
  })
}

for (const country of ['', 'RU', 'BY', 'PL']) {
  test(`region selection and failed registry cache: ${country || 'automatic'}`, async () => {
    const urls = []
    const state = fixture({ storage: {
      currentRegionCode: country, registryRegionCode: 'RU', domains: ['cached.example'],
    }, mocks: { 'service-request': { requestService: async url => {
      urls.push(url)
      if (url.includes('geo.')) return { data: { countryCode: 'PL' }, viaProxy: true }
      if (url.includes('disseminators')) return { data: [] }
      throw new Error('offline')
    } } } })
    await state.load('server').synchronizeInBackground({ syncProxy: false })
    assert.equal(state.storage.localConfig.countryCode, country || 'RU')
    assert.deepEqual(state.storage.domains, ['', 'RU'].includes(country) ? ['cached.example'] : [])
    assert.equal(urls.some(url => url.includes('geo.')), !country)
  })
}

test('proxy-only recovery does not request regional services', async () => {
  const urls = []
  const state = fixture({ mocks: { 'service-request': { requestService: async url => {
    urls.push(url)
    throw new Error('offline')
  } } } })
  await state.load('server').synchronizeInBackground({ syncRegistry: false })
  assert.deepEqual(urls, ['https://cozyquokka.net/api/proxy-list/'])
})

test('concurrent services have no overlapping temporary routes', async () => {
  let active = 0
  const state = fixture({ fetch: async (url, init, { route }) => {
    assert.equal(++active, 1)
    assert.equal(route(new URL(url).hostname), 'DIRECT')
    await new Promise(resolve => setTimeout(resolve, 5))
    active--
    return response([])
  } })
  const { requestService } = state.load('service-request')
  await Promise.all([
    requestService('https://first.example', Array.isArray),
    requestService('https://second.example', Array.isArray),
  ])
  assert.deepEqual(state.settings().value, state.original)
})

for (const protocol of ['SOCKS5', 'HTTP']) {
  test(`configured proxy protocol: ${protocol}`, async () => {
    let calls = 0
    const state = fixture({ protocol, fetch: async (url, init, { route }) => {
      if (++calls === 1) throw new Error('offline')
      const pacProtocol = protocol === 'HTTP' ? 'PROXY' : protocol
      assert.equal(route('service.example'), `${pacProtocol} retry.example:443`)
      return response([])
    } })
    await state.load('service-request').requestService('https://service.example', Array.isArray)
    assert.deepEqual(state.settings().value, state.original)
  })
}

test('successful registry update replaces cached data', async () => {
  const state = fixture({ storage: { currentRegionCode: 'RU', registryRegionCode: 'RU', domains: ['old.example'] },
    mocks: { 'service-request': { requestService: async url => ({ data: url.includes('/api/config/') ? { customRegistryUrl: null }
      : url.includes('disseminators') ? [] : ['new.example'] }) } },
  })
  await state.load('server').synchronizeInBackground({ syncProxy: false })
  assert.deepEqual(state.storage.domains, ['new.example'])
  assert.deepEqual(state.storage.serviceErrors, [])
})

for (const [data, expected, status, skipped] of [
  [['valid.example', 'olbplxx-specialistudospecialistudospeciali-specialistudo.xn--click   -66gc5anake5ijjnbcs0m', null], ['valid.example'], 'ready', 2],
  [[], [], 'empty', 0],
  [[null, 'invalid domain'], ['cached.example'], 'unavailable', 0],
  [{ domains: ['valid.example'] }, ['cached.example'], 'unavailable', 0],
]) {
  test(`registry status ${status} filters invalid entries and keeps a failed cache`, async () => {
    const state = fixture({ storage: { currentRegionCode: 'RU', registryRegionCode: 'RU', domains: ['cached.example'] },
      mocks: { 'service-request': { requestService: async (url, validate) => {
        const response = url.includes('/api/config/') ? { customRegistryUrl: null }
          : url.includes('disseminators') || url.includes('/api/domains/') ? [] : data
        if (!validate(response)) throw new Error('Response validation failed')
        return { data: response }
      } } },
    })
    await state.load('server').synchronizeInBackground({ syncProxy: false })
    assert.deepEqual(state.storage.domains, expected)
    assert.equal(state.storage.registryStatus.state, status)
    assert.equal(state.storage.registryStatus.skipped, skipped)
    assert.equal(!!state.storage.registryStatus.error, status === 'unavailable')
  })
}

for (const firefox of [false, true]) {
  test(`always-proxy service choice skips direct access: Firefox=${firefox}`, async () => {
    let calls = 0
    const state = fixture({ firefox, storage: { customProxiedDomains: ['example.com'] },
      fetch: async (url, init, { route }) => {
        calls++
        assert.equal(route('api.example.com'), 'HTTPS retry.example:443')
        return response([])
      },
    })
    assert.equal((await state.load('service-request').requestService('https://api.example.com', Array.isArray)).viaProxy, true)
    assert.equal(calls, 1)
    assert.equal(state.storage.serviceRouteSnapshot, undefined)
  })

  test(`service retry uses a proxy with an allowed country: Firefox=${firefox}`, async () => {
    let calls = 0
    const state = fixture({ firefox, storage: { siteCountryRules: { 'example.com': ['RU'] } },
      proxies: [{ id: 'ru', protocol: 'HTTPS', host: 'forbidden.example', port: 443, exitCountry: 'RU', countryExpiresAt: Date.now() + 10000 },
        { id: 'de', protocol: 'HTTPS', host: 'allowed.example', port: 443, exitCountry: 'DE', countryExpiresAt: Date.now() + 10000 }],
      fetch: async (url, init, { route }) => {
        if (++calls === 1) throw new Error('offline')
        assert.equal(route('api.example.com'), 'HTTPS allowed.example:443')
        return response([])
      },
    })
    await state.load('service-request').requestService('https://api.example.com', Array.isArray)
    assert.equal(calls, 2)
    assert.equal(state.storage.serviceRouteSnapshot, undefined)
  })
}

test('country rules changed during proxy setup prevent a stale service retry', async () => {
  let calls = 0
  const state = fixture({ fetch: async () => { calls++; throw new Error('offline') } })
  const set = state.browser.proxy.settings.set
  state.browser.proxy.settings.set = async args => {
    await set(args)
    if (state.events.includes('knock')) state.storage.siteCountryRules = { 'example.com': ['RU'] }
  }
  await assert.rejects(state.load('service-request').requestService('https://api.example.com', Array.isArray), /country rules/)
  assert.equal(calls, 1)
  assert.equal(state.storage.serviceRouteSnapshot, undefined)
})

test('GeoIP does not retry through a proxy or an always-proxy rule', async () => {
  for (const forced of [false, true]) {
    let calls = 0
    const state = fixture({ storage: { customProxiedDomains: forced ? ['geo.example'] : [] },
      fetch: async () => { calls++; throw new Error('GeoIP offline') },
    })
    await assert.rejects(state.load('service-request').requestService('https://geo.example/iso', () => true, { allowProxyRetry: false }), /geo.example\/iso: DIRECT/)
    assert.equal(calls, forced ? 0 : 1)
    assert.ok(!state.events.includes('knock'))
  }
})

for (const success of [false, true]) {
  test(`route restoration errors do not replace service results: success=${success}`, async () => {
    const state = fixture({ fetch: async () => {
      if (!success) throw new Error('GeoIP offline')
      return response({ countryCode: 'DE' })
    } })
    const set = state.browser.proxy.settings.set
    state.browser.proxy.settings.set = async args => {
      if (JSON.stringify(args.value) === JSON.stringify(state.original)) throw new Error('PAC restoration failed')
      return set(args)
    }
    const pending = state.load('service-request').requestService('https://geo.example/iso', () => true, { allowProxyRetry: false })
    if (success) assert.equal((await pending).data.countryCode, 'DE')
    else await assert.rejects(pending, error => /GeoIP offline/.test(error.message) && !/PAC restoration/.test(error.message))
    assert.match(state.storage.serviceRouteError, /geo.example\/iso: route restoration failed: PAC restoration failed/)
    assert.ok(state.storage.serviceRouteSnapshot)
  })
}

test('service deadline reports a timeout while reading JSON', async () => {
  const state = fixture({ fastTimeout: true, fetch: async (url, init) => ({ ok: true,
    json: () => new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('The operation was aborted')))),
  }) })
  await assert.rejects(state.load('service-request').requestService('https://registry.example/list', Array.isArray, { allowProxyRetry: false }), /registry.example\/list: DIRECT: JSON parsing: Timeout after 60 seconds/)
  assert.equal(state.storage.serviceRouteSnapshot, undefined)
})

test('settings cancellation is distinct from a service timeout', async () => {
  const state = fixture({ fetch: async (url, init) => new Promise((resolve, reject) => {
    init.signal.addEventListener('abort', () => reject(new Error('The operation was aborted')))
    state.storage.useProxy = false
    for (const listener of state.listeners) listener({ useProxy: { newValue: false } })
  }) })
  await assert.rejects(state.load('service-request').requestService('https://registry.example/list', Array.isArray, { allowProxyRetry: false }), /Cancelled because routing settings changed/)
  assert.equal(state.storage.serviceRouteSnapshot, undefined)
})

test('changing the proxy endpoint cancels an active service retry', async () => {
  let calls = 0
  const state = fixture({ fetch: async (url, init) => {
    if (++calls === 1) throw new Error('offline')
    return new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('The operation was aborted')))
      state.storage.proxyServerURI = 'changed.example:443'
      for (const listener of state.listeners) listener({ proxyServerURI: { newValue: state.storage.proxyServerURI } })
    })
  } })
  await assert.rejects(state.load('service-request').requestService('https://registry.example/list', Array.isArray), /PROXY: fetch: Cancelled because routing settings changed/)
  assert.equal(calls, 2)
  assert.equal(state.storage.serviceRouteSnapshot, undefined)
})

test('direct GeoIP selects country, proxied GeoIP does not', async () => {
  const state = fixture({ mocks: { 'service-request': { requestService: async url => {
    if (url.includes('geo.')) return { data: { countryCode: 'PL' }, viaProxy: false }
    return { data: [] }
  } } } })
  await state.load('server').synchronizeInBackground({ syncProxy: false })
  assert.equal(state.storage.localConfig.countryCode, 'PL')
  assert.equal(state.storage.geoIPStatus, 'direct')
})

test('GeoIP fallback records its own failure and disables proxy retries', async () => {
  const state = fixture({ mocks: { 'service-request': { requestService: async (url, validate, options) => {
    if (url.includes('geo.')) {
      assert.equal(options.allowProxyRetry, false)
      throw new Error('GeoIP offline')
    }
    if (url.includes('proxy-list')) throw new Error('Proxy list offline')
    return { data: [] }
  } } } })
  await state.load('server').synchronizeInBackground()
  assert.equal(state.storage.geoIPStatus, 'RU fallback: GeoIP offline')
  assert.ok(state.storage.serviceErrors.some(error => error.includes('Proxy list offline')))
})

test('database update waits for completion and rejects a failed sync', async () => {
  for (const failed of [false, true]) {
    let finish, completed = false
    const { updateRegistry } = loadOperations({
      server: { synchronize: () => new Promise(resolve => { finish = resolve }) },
      'browser-api': { default: { storage: { local: { get: async () => ({ serviceErrors: failed ? ['Registry: HTTP 503'] : [] }) } } } },
      proxy: { default: { isEnabled: async () => false } },
    })
    const pending = updateRegistry().then(() => { completed = true })
    assert.equal(completed, false)
    finish()
    if (failed) await assert.rejects(pending, /Registry: HTTP 503/)
    else await pending
    assert.equal(completed, !failed)
  }
})

test('database update applies the new registry routes after an ORI failure', async () => {
  const state = fixture({ storage: { currentRegionCode: 'RU', registryRegionCode: 'RU', domains: ['old.example'] },
    mocks: { proxy: null, registry: { default: { getRoutingDomains: async () => state.storage.domains } },
      'service-request': { requestService: async url => {
        if (url.includes('disseminators')) throw new Error('HTTP 503')
        if (url.includes('/api/config/')) return { data: { customRegistryUrl: null } }
        return { data: ['new.example'] }
      } },
    },
  })
  let applied = 0
  const { updateRegistry } = loadOperations({
    server: { synchronize: () => state.load('server').synchronizeInBackground({ syncProxy: false }) },
    'browser-api': { default: state.browser },
    proxy: { default: { isEnabled: async () => true, removeBadProxies: async () => {}, ping: async () => {},
      setProxy: async () => { applied++; return state.load('proxy').default.setProxyInBackground({ ping: false }) },
    } },
  })
  await assert.rejects(updateRegistry(), /ORI: HTTP 503/)
  assert.deepEqual(state.storage.domains, ['new.example'])
  assert.equal(applied, 1)
  assert.equal(state.route('new.example'), 'HTTPS normal.example:443;')
  assert.equal(state.route('old.example'), 'DIRECT')
})

for (const value of [{ mode: 'system' }, { mode: 'fixed_servers' }, { proxyType: 'system' }, { proxyType: 'manual' }]) {
  for (const useProxy of [false, true]) {
    test(`preserve external routes and distrust GeoIP: ${JSON.stringify(value)}, enabled=${useProxy}`, async () => {
      const state = fixture({ value, control: 'controllable_by_this_extension', storage: { useProxy },
        fetch: async () => response({ countryCode: 'PL' }),
      })
      const result = await state.load('service-request').requestService('https://service.example', () => true)
      assert.equal(result.viaProxy, true)
      assert.deepEqual(state.settings().value, value)
      assert.deepEqual(state.events, ['fetch'])
    })
  }
}

test('recheck inherited proxy after clearing disabled CT route', async () => {
  const state = fixture({ inherited: { mode: 'system' }, storage: { useProxy: false },
    fetch: async () => response({ countryCode: 'PL' }),
  })
  const result = await state.load('service-request').requestService('https://service.example', () => true)
  assert.equal(result.viaProxy, true)
  assert.deepEqual(state.events, ['clear', 'fetch'])
})

test('GeoIP is untrusted if proxy control changes during the request', async () => {
  const state = fixture({ fetch: async () => {
    for (const listener of state.routeListeners) listener({ levelOfControl: 'controlled_by_other_extensions' })
    return response({ countryCode: 'PL' })
  } })
  const result = await state.load('service-request').requestService('https://service.example', () => true)
  assert.equal(result.viaProxy, true)
  assert.equal(state.routeListeners.size, 0)
})

test('failed startup recovery is retried before the next proxy operation', async () => {
  const state = fixture()
  state.storage.serviceRouteSnapshot = { owned: true, value: state.original }
  const setting = state.browser.proxy.settings
  const originalSet = setting.set
  let attempts = 0
  setting.set = async args => {
    if (++attempts === 1) throw new Error('temporary failure')
    return originalSet(args)
  }
  const { withProxyLock } = state.load('proxy-route')
  await assert.rejects(withProxyLock(() => {}))
  await withProxyLock(() => assert.equal(state.storage.serviceRouteSnapshot, undefined))
  assert.equal(attempts, 2)
})

test('normal PAC update cannot re-enable proxy use during a disable action', async () => {
  const state = fixture({ mocks: {
    proxy: null, registry: { default: { getRoutingDomains: async () => ['example.com'] } },
  } })
  const setting = state.browser.proxy.settings
  const originalSet = setting.set
  setting.set = async args => {
    state.storage.useProxy = false
    return originalSet(args)
  }
  await state.load('proxy').default.setProxyInBackground()
  assert.equal(state.storage.useProxy, false)
  assert.equal(state.settings().value.mode, 'direct')
})

test('request permission cache is invalidated by control and user setting changes', async () => {
  const state = fixture()
  let reads = 0
  let control = 'controlled_by_this_extension'
  state.browser.proxy.settings.get = async () => { reads++; return { levelOfControl: control } }
  const { proxyRequestAllowed } = state.load('proxy-route')
  assert.equal(await proxyRequestAllowed(), true)
  assert.equal(await proxyRequestAllowed(), true)
  assert.equal(reads, 1)
  control = 'controlled_by_other_extensions'
  for (const listener of state.routeListeners) listener({ levelOfControl: control })
  assert.equal(await proxyRequestAllowed(), false)
  control = 'controlled_by_this_extension'
  state.storage.useProxy = false
  for (const listener of state.listeners) listener({ useProxy: { newValue: false } }, 'local')
  assert.equal(await proxyRequestAllowed(), false)
})

test('a transient permission read failure does not poison later authentication', async () => {
  const state = fixture()
  const original = state.browser.proxy.settings.get
  let reads = 0
  state.browser.proxy.settings.get = async () => {
    if (++reads === 1) throw new Error('temporary read failure')
    return original()
  }
  const { proxyRequestAllowed } = state.load('proxy-route')
  await assert.rejects(proxyRequestAllowed())
  assert.equal(await proxyRequestAllowed(), true)
})

test('a routing change during port knock cannot install the old proxy', async () => {
  const state = fixture({ storage: {
    customProxyProtocol: 'HTTPS', customProxyServerURI: 'old.example:443',
  }, mocks: {
    proxy: null, registry: { default: { getRoutingDomains: async () => ['example.com'] } },
  } })
  const proxy = state.load('proxy').default
  let knocks = 0
  proxy.pingInBackground = async () => {
    if (++knocks === 1) {
      state.storage.customProxyServerURI = 'new.example:443'
      for (const fn of state.listeners) fn({ customProxyServerURI: { newValue: 'new.example:443' } }, 'local')
    }
  }
  await proxy.setProxyInBackground()
  assert.equal(knocks, 2)
  assert.equal(state.events.filter(event => event === 'set').length, 1)
  assert.match(state.settings().value.pacScript.data, /new\.example/)
  assert.doesNotMatch(state.settings().value.pacScript.data, /old\.example/)
})

test('failed PAC application does not turn the user proxy setting off', async () => {
  const state = fixture({ mocks: {
    proxy: null, registry: { default: { getRoutingDomains: async () => ['example.com'] } },
  } })
  state.browser.proxy.settings.set = async () => { throw new Error('cannot apply') }
  assert.equal(await state.load('proxy').default.setProxyInBackground(), false)
  assert.equal(state.storage.useProxy, true)
  assert.equal(state.storage.proxyIsAlive, false)
})

test('an empty proxy pool installs a blocking route without disabling the extension', async () => {
  const state = fixture({ storage: { proxies: [], selectedProxyIds: [] }, mocks: {
    proxy: null, registry: { default: { getRoutingDomains: async () => [] } },
  } })
  assert.equal(await state.load('proxy').default.setProxyInBackground(), true)
  assert.equal(state.route('test.onion'), 'PROXY 127.0.0.1:0')
  assert.equal(state.route('other.example'), 'DIRECT')
  assert.equal(state.settings().value.pacScript.mandatory, true)
  assert.equal(state.storage.useProxy, true)
  assert.equal(state.storage.proxyIsAlive, false)
})

for (const firefox of [false, true]) {
  test(`proxy health survives setup, enabling and address refresh: Firefox=${firefox}`, async () => {
    const state = fixture({ firefox, mocks: {
      proxy: null, registry: { default: { getRoutingDomains: async () => [] } },
      'service-mirrors': { getServiceMirrors: async () => [], requestMirroredService: async () => ({
        data: [{ active: true, weight: 1, server: 'normal.example', port: 443,
          pingHost: 'knock.example', pingPort: 8443 }],
      }) },
    } })
    const manager = state.load('proxy').default
    const [proxy] = await manager.getSelectedProxies()
    await state.load('proxy-health').recordProxyHealth(proxy, true)
    assert.equal(await manager.setProxyInBackground({ ping: false }), true)
    assert.equal(state.storage.proxyIsAlive, false)
    await manager.enableProxy()
    await state.load('server').synchronizeInBackground({ syncRegistry: false })
    assert.equal(state.storage.proxyIsAlive, false)
    await manager.setProxyInBackground({ ping: false })
    assert.equal(state.storage.proxyIsAlive, false)
    await state.load('proxy-health').recordProxyHealth(proxy, false)
    await manager.setProxyInBackground({ ping: false })
    assert.equal(state.storage.proxyIsAlive, true)
  })
}

test('proxy-all reports failed application but preserves a disabled user preference', async () => {
  let actions
  const state = fixture({ mocks: {
    proxy: null, handlers: { scheduleLocalProxyCheck: async () => {} },
    server: {}, settings: { default: {} },
    'proxy-auth': { registerProxyAuth() {} },
    ignore: { default: {} },
    registry: { default: { getRoutingDomains: async () => [] } },
    'background-rpc': { registerBackground: value => { actions = value } },
  } })
  state.browser.proxy.settings.set = async () => { throw new Error('cannot apply') }
  state.load('background').startBackground()
  await assert.rejects(actions.setProxyAll(true), /could not be applied/)
  assert.equal(state.storage.proxyAll, true)
  state.storage.useProxy = false
  await actions.setProxyAll(false)
  assert.equal(state.storage.proxyAll, false)
  await assert.rejects(actions.setProxyAll('true'), /Invalid/)
  assert.equal(state.storage.proxyAll, false)
})

for (const outcome of ['enabled', 'disabled', 'failed']) {
  test(`settings import restores an external registry without auto-update: ${outcome}`, async () => {
    let actions
    let downloads = 0
    const source = { kind: 'custom', url: 'https://source.example/list',
      enabled: outcome !== 'disabled', autoUpdate: false }
    const state = fixture({ mocks: {
      handlers: { scheduleLocalProxyCheck: async () => {} }, server: {}, utilities: {},
      'proxy-auth': { registerProxyAuth() {} },
      'background-rpc': { registerBackground: value => { actions = value } },
      proxy: { default: {
        syncLocalProxy: async () => {}, syncLocalProxyInBackground: async () => {},
        setProxyInBackground: async () => { state.events.push('apply'); return true },
      } },
      request: { requestText: async url => {
        assert.equal(url, source.url)
        downloads++
        if (outcome === 'failed') throw new Error('Download failed')
        return { data: 'external.example' }
      } },
    } })
    state.load('background').startBackground()
    const imported = actions.importSettings({ formatVersion: 1, settings: {
      enableExtension: true, useRegistry: false, registrySource: source,
    } })
    if (outcome === 'failed') {
      await assert.rejects(imported, /External registry update failed/)
    } else {
      await imported
    }
    assert.equal(downloads, source.enabled ? 1 : 0)
    assert.deepEqual(state.storage.registrySource, source)
    assert.deepEqual(Array.from(await state.load('registry').default.getDomains()),
      outcome === 'enabled' ? ['external.example'] : [])
    assert.equal(state.events.filter(event => event === 'apply').length,
      outcome === 'enabled' ? 2 : 1)
  })
}

for (const outcome of ['success', 'no private permission', 'sync failure', 'route failure']) {
  test(`reset applies all defaults before sync and reports success only when ready: ${outcome}`, async () => {
    const state = fixture({ storage: {
      enableExtension: false, useProxy: false, useRegistry: false, uiLanguage: 'ru',
      useLocalProxy: true, localProxyURI: '127.0.0.1:1080', localProxyAlive: true,
      proxyAll: true, ignoredHosts: ['ignored.example'], customProxiedDomains: ['custom.example'],
      siteCountryRules: { 'custom.example': ['RU'] }, currentRegionCode: 'BY',
      proxies: [{ id: 'custom', protocol: 'HTTP', host: 'proxy.example', port: 80 }],
      selectedProxyIds: ['custom'], proxyRecoveryEnabled: true,
      proxySubscriptions: [{ id: 'source', url: 'https://source.example/proxies', protocol: 'HTTP' }],
      proxySubscriptionsEnabled: true,
      registrySource: { kind: 'custom', url: 'https://source.example/domains', enabled: true, autoUpdate: true },
    }, mocks: { 'background-rpc': { callBackground: async (action, args) => {
      assert.equal(action, 'importSettings')
      await settings.importSettingsInBackground(args)
    } } } })
    const settings = state.load('settings').default
    const expected = { ...state.load('settings-data').settingsDefaults,
      enableExtension: true, proxies: [], selectedProxyIds: ['builtin'] }
    const checkDefaults = () => {
      for (const [key, value] of Object.entries(expected)) {
        assert.deepEqual(state.storage[key], clone(value), key)
      }
      assert.equal(state.storage.localProxyURI, null)
      assert.equal(state.storage.localProxyAlive, false)
    }
    const { resetSettings } = loadOperations({
      'browser-api': { default: state.browser }, settings: { default: settings },
      server: { synchronize: async () => {
        checkDefaults()
        state.storage.serviceErrors = outcome === 'sync failure' ? ['Sync failed'] : []
      } },
      proxy: { default: { removeBadProxies() {}, ping() { assert.notEqual(outcome, 'no private permission') },
        requestIncognitoAccess: async () => outcome !== 'no private permission',
        setProxy: async () => { assert.notEqual(outcome, 'no private permission'); checkDefaults(); return outcome !== 'route failure' },
      } },
    })
    if (['success', 'no private permission'].includes(outcome)) await resetSettings()
    else await assert.rejects(resetSettings(), outcome === 'sync failure' ? /Sync failed/ : /proxySetupFailed/)

  })
}

test('the last registry choice survives an earlier pending download', async () => {
  const state = fixture({ storage: { useRegistry: false }, mocks: { utilities: {} } })
  let release, started
  const ready = new Promise(resolve => { started = resolve })
  const applied = []
  const { setRegistryEnabled } = loadUI('../ui/pages/registry-operations', {
    registry: { default: state.load('registry').default },
    proxy: { default: { setProxy: async () => { applied.push(state.storage.useRegistry) } } },
    server: { synchronize: () => { started(); return new Promise(resolve => { release = resolve }) } },
  })
  const enabling = setRegistryEnabled(true)
  await ready
  await setRegistryEnabled(false)
  assert.equal(state.storage.useRegistry, false)
  release()
  await enabling
  assert.equal(state.storage.useRegistry, false)
  assert.deepEqual(applied, [false, false])
})

for (const code of ['RU', 'BY']) {
  test(`manual region ${code} clears mismatched cache before sync with proxy disabled`, async () => {
    const expected = code === 'RU' ? ['old.example'] : []
    const state = fixture({ storage: { useProxy: false, domains: ['old.example'], localConfig: { countryCode: 'RU' } },
      mocks: { 'service-request': { requestService: async () => {
        assert.deepEqual(state.storage.domains, expected)
        assert.equal(state.events[0], 'refresh')
        throw new Error('offline')
      } } },
    })
    const { setRegistryCountry } = loadUI('../ui/pages/registry-operations', {
      proxy: {}, registry: {},
      server: { synchronize: options => state.load('server').synchronizeInBackground({ ...options, syncProxy: false }) },
    })
    await setRegistryCountry(code, code)
    assert.equal(state.storage.currentRegionCode, code)
    assert.deepEqual(state.events, ['refresh', 'refresh'])
  })
}

test('disable during retry PAC installation prevents the proxy request', async () => {
  let calls = 0
  const state = fixture({ fetch: async () => { calls++; throw new Error('offline') } })
  const setting = state.browser.proxy.settings
  const originalSet = setting.set
  setting.set = async args => {
    await originalSet(args)
    if (state.events.includes('knock')) state.storage.useProxy = false
  }
  await assert.rejects(state.load('service-request').requestService('https://service.example', Array.isArray))
  assert.equal(calls, 1)
  assert.equal(state.storage.useProxy, false)
  assert.equal(state.storage.serviceRouteSnapshot, undefined)
})

test('disable aborts direct requests and releases temporary proxy routes', async () => {
  const state = fixture({ fetch: async (url, init, { storage, listeners }) => {
    return new Promise((resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('disabled')))
      storage.useProxy = false
      for (const listener of listeners) listener({ useProxy: { newValue: false } })
    })
  } })
  await assert.rejects(state.load('service-request').requestService('https://service.example', Array.isArray))
  assert.equal(state.storage.serviceRouteSnapshot, undefined)
  assert.ok(state.events.includes('clear'))
})

test('returning after a cancelled region change restores unchanged cached domains', async () => {
  let cancel = true
  const state = fixture({ storage: {
    currentRegionCode: 'RU', registryRegionCode: 'RU', domains: ['blocked.example'],
    registryCache: { countryCode: 'RU', primary: ['blocked.example'], custom: [],
      backend: [], validators: { primary: {}, custom: {}, backend: {} } },
  }, mocks: { 'service-request': { requestService: async url => {
    if (cancel) throw Object.assign(new Error('cancelled'), { name: 'AbortError' })
    if (url.includes('/api/config/')) return { data: { customRegistryUrl: null } }
    if (url.includes('disseminators')) return { data: [] }
    return { unchanged: true }
  } } } })
  const sync = code => state.load('server').synchronizeInBackground({
    syncProxy: false, region: { countryCode: code, countryName: code },
  })
  await assert.rejects(sync('BY'))
  assert.deepEqual(state.storage.domains, [])
  cancel = false
  await sync('RU')
  assert.deepEqual(state.storage.domains, ['blocked.example'])
  assert.equal(state.storage.registryStatus.state, 'ready')
})

test('queued region selection cannot be overwritten by an old-country download', async () => {
  let release
  let started
  const fetching = new Promise(resolve => { started = resolve })
  const state = fixture({ storage: { currentRegionCode: 'RU', registryRegionCode: 'RU' },
    mocks: { 'service-request': { requestService: async url => {
      if (url.includes('ct-domains')) {
        started()
        await new Promise(resolve => { release = resolve })
        return { data: ['russian.example'] }
      }
      if (url.endsWith('by.json')) throw new Error('offline')
      return { data: [] }
    } } },
  })
  const { synchronizeInBackground } = state.load('server')
  const oldRequest = synchronizeInBackground({ syncProxy: false })
  await fetching
  const selection = synchronizeInBackground({ syncProxy: false, region: { countryCode: 'BY', countryName: 'Belarus' } })
  release()
  await Promise.all([oldRequest, selection])
  assert.equal(state.storage.currentRegionCode, 'BY')
  assert.equal(state.storage.registryRegionCode, 'BY')
  assert.deepEqual(state.storage.domains, [])
  assert.equal(state.events.at(-1), 'refresh')
})


for (const failure of ['', 'primary', 'custom', 'config', 'both']) {
  test(`customRegistryUrl merges country caches: ${failure || 'success'}`, async () => {
    const urls = []
    const customUrl = 'https://custom.example/registry'
    const state = fixture({ storage: {
      currentRegionCode: 'ru', registryRegionCode: 'RU',
      registryCache: { countryCode: 'RU', primary: ['old-primary.example'], custom: ['old-custom.example'] },
    }, mocks: { 'service-request': { requestService: async (url, validate) => {
      urls.push(url)
      if (url.includes('/api/domains/')) return { data: [] }
      if (url.includes('/api/config/')) {
        if (failure === 'config') throw new Error('Config unavailable')
        return { data: { customRegistryUrl: customUrl } }
      }
      if (url.includes('disseminators')) return { data: [] }
      const source = url === customUrl ? 'custom' : 'primary'
      if (failure === source || failure === 'both') throw new Error(`${source} unavailable`)
      const data = source === 'primary' ? ['primary.example', 'shared.example']
        : [{ domains: ['custom.example', 'shared.example', null] }, { domains: ['other.example'] }]
      assert.equal(validate(data), true)
      return { data }
    } } } })
    await state.load('server').synchronizeInBackground({ syncProxy: false })
    assert.ok(urls.includes('https://cozyquokka.net/api/config/RU/'))
    assert.equal(urls.includes(customUrl), failure !== 'config')
    const primary = ['primary', 'both'].includes(failure)
      ? ['old-primary.example'] : ['primary.example', 'shared.example']
    const custom = ['custom', 'config', 'both'].includes(failure)
      ? ['old-custom.example'] : ['custom.example', 'shared.example', 'other.example']
    assert.deepEqual(state.storage.domains, [...new Set([...primary, ...custom])])
    const { updatedAt, validators, ...cache } = state.storage.registryCache
    assert.deepEqual(cache, { countryCode: 'RU', primary, custom, backend: [] })
    assert.equal(Boolean(updatedAt), !failure || failure === 'config')
    assert.equal(state.storage.registryStatus.state, failure && failure !== 'config' ? 'unavailable' : 'ready')
    assert.equal(state.storage.registryStatus.skipped, failure === 'primary' || !failure ? 1 : 0)
    assert.equal(state.storage.serviceErrors.length, failure && failure !== 'config' ? 1 : 0)
    if (failure !== 'config') assert.equal(state.storage.localConfig.customRegistryUrl, customUrl)
  })
}

for (const customRegistryUrl of [null, '', 'https://custom.example/registry']) {
  test(`empty custom registry clears only its cache: ${customRegistryUrl}`, async () => {
    const state = fixture({ storage: {
      currentRegionCode: 'RU', registryRegionCode: 'RU',
      registryCache: { countryCode: 'RU', primary: ['primary.example'], custom: ['old-custom.example'] },
    }, mocks: { 'service-request': { requestService: async url => {
      if (url.includes('/api/config/')) return { data: { customRegistryUrl } }
      if (url.includes('disseminators') || url === customRegistryUrl) return { data: [] }
      throw new Error('Primary unavailable')
    } } } })
    await state.load('server').synchronizeInBackground({ syncProxy: false })
    assert.deepEqual(state.storage.domains, ['primary.example'])
    assert.deepEqual(state.storage.registryCache.custom, [])
  })
}

for (const code of ['RU', 'PL']) {
  test(`custom registry legacy cache and region change: ${code}`, async () => {
    const state = fixture({ storage: {
      currentRegionCode: code, registryRegionCode: 'RU', domains: ['legacy.example'],
    }, mocks: { 'service-request': { requestService: async url => {
      if (url.includes('/api/config/')) return { data: { customRegistryUrl: 'https://custom.example/list' } }
      if (url === 'https://custom.example/list') return { data: [{ domains: ['custom.example'] }] }
      if (url.includes('disseminators')) return { data: [] }
      throw new Error('Primary unavailable')
    } } } })
    await state.load('server').synchronizeInBackground({ syncProxy: false })
    assert.deepEqual(state.storage.domains, code === 'RU' ? ['legacy.example', 'custom.example'] : ['custom.example'])
    assert.equal(state.storage.registryCache.countryCode, code)
    assert.equal(state.storage.registryRegionCode, code)
  })
}

test('custom registry validators reject malformed responses', () => {
  const { validConfig, validCustomRegistry } = fixture().load('service-config')
  for (const data of [null, [], 'config', { customRegistryUrl: 123 }]) assert.ok(!validConfig(data))
  for (const data of [{ customRegistryUrl: null }, { customRegistryUrl: 'https://custom.example/list' }]) assert.ok(validConfig(data))
  for (const data of [null, {}, ['domain.example'], [{ domains: null }], [{ domains: [null] }]]) assert.equal(validCustomRegistry(data), false)
  for (const data of [[], [{ domains: [] }], [{ domains: ['valid.example', null] }]]) assert.equal(validCustomRegistry(data), true)
})

for (const firefox of [false, true]) {
  test(`API sync retries direct failures through the managed proxy: Firefox=${firefox}`, async () => {
    const attempts = new Map()
    const customRegistryUrl = 'https://custom.example/registry'
    const state = fixture({ firefox,
      storage: { currentRegionCode: 'RU', registryRegionCode: 'RU', selectedProxyIds: ['builtin'] },
      mocks: { proxy: null, registry: { default: { getRoutingDomains: async () => [] } } },
      fetch: async (url, init, { route, storage }) => {
        const host = new URL(url).hostname
        if (init.method === 'POST') {
          assert.equal(route(host), 'DIRECT')
          return response([])
        }
        const attempt = (attempts.get(url) || 0) + 1
        attempts.set(url, attempt)
        assert.equal(route('other.example'), 'HTTPS normal.example:443')
        if (attempt === 1) {
          assert.equal(route(host), 'DIRECT')
          throw new Error('Direct API connection failed')
        }
        assert.equal(attempt, 2)
        assert.equal(route(host), `HTTPS ${storage.proxyServerURI}`)
        if (url.includes('proxy-list')) return response([{
          server: 'managed.example', port: '443', pingHost: 'knock.example',
          pingPort: '8443', active: true, weight: 1,
        }])
        if (url.includes('/api/config/')) return response({ customRegistryUrl })
        if (url === customRegistryUrl) return response([{ domains: ['custom.example'] }])
        return response(url.includes('ct-domains') ? ['blocked.example'] : [])
      },
    })
    await state.load('server').synchronizeInBackground()
    const config = state.load('service-config')
    assert.deepEqual([...attempts], [config.PROXY_LIST_URL, config.getRegionConfig('RU').registryUrl,
      `${config.CONFIG_URL}RU/`, customRegistryUrl, `${config.DOMAINS_URL}RU/`, config.ORI_URL].map(url => [url, 2]))
    assert.deepEqual(state.storage.domains, ['blocked.example', 'custom.example'])
    assert.deepEqual(state.storage.serviceErrors, [])
    assert.equal(state.storage.registryStatus.state, 'ready')
    assert.equal(state.storage.serviceRouteSnapshot, undefined)
    assert.equal(state.route('other.example'), 'HTTPS normal.example:443')
  })
}

for (const endpoint of ['config', 'domains']) {
  for (const failure of ['404', '410', 'network', 'json', 'invalid', 'timeout']) {
    test(`optional ${endpoint} ignores ${failure} and preserves its country cache`, async () => {
      let attempts = 0
      const state = fixture({ fastTimeout: failure === 'timeout', storage: {
        currentRegionCode: 'ru', registryRegionCode: 'RU',
        registryCache: { countryCode: 'RU', primary: [], custom: ['old-custom.example'], backend: ['old-backend.example'] },
      }, fetch: async (url, init) => {
        if (url.includes(`/api/${endpoint}/`)) {
          attempts++
          if (['404', '410'].includes(failure)) return { ok: false, status: Number(failure) }
          if (failure === 'network') throw new Error('offline')
          if (failure === 'json') return { ok: true, json: async () => { throw new Error('Invalid JSON') } }
          if (failure === 'invalid') return response(endpoint === 'config' ? [] : {})
          return new Promise((resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted'))))
        }
        if (url.includes('/api/config/')) return response({ customRegistryUrl: 'https://custom.example/list' })
        if (url === 'https://custom.example/list') return response([{ domains: ['custom.example'] }])
        if (url.includes('/api/domains/')) {
          assert.equal(url, 'https://cozyquokka.net/api/domains/RU/')
          assert.equal(init.redirect, 'manual')
          return response(['backend.example', 'shared.example', null])
        }
        return response(url.includes('ct-domains') ? ['primary.example', 'shared.example'] : [])
      } })
      await state.load('server').synchronizeInBackground({ syncProxy: false })
      assert.equal(attempts, ['404', '410'].includes(failure) ? 1 : 2)
      assert.deepEqual(state.storage.domains, endpoint === 'config'
        ? ['primary.example', 'shared.example', 'old-custom.example', 'backend.example']
        : ['primary.example', 'shared.example', 'custom.example', 'old-backend.example'])
      assert.equal(state.storage.registryStatus.state, 'ready')
      assert.equal(state.storage.registryStatus.error, '')
      assert.deepEqual(state.storage.serviceErrors, [])
      assert.equal(state.storage.serviceRouteSnapshot, undefined)
      assert.equal(state.headerListeners.size, 0)
    })
  }
}

for (const [countryCode, data] of [['RU', []], ['BY', null]]) {
  test(`backend cache clears on empty response or country change: ${countryCode}`, async () => {
    const state = fixture({ storage: { currentRegionCode: countryCode, registryRegionCode: 'RU',
      registryCache: { countryCode: 'RU', primary: [], custom: [], backend: ['russian.example'] },
    }, mocks: { 'service-request': { requestService: async url => {
      if (url.includes('/api/config/')) throw new Error('HTTP 404')
      if (url.includes('/api/domains/')) {
        if (data === null) throw new Error('HTTP 404')
        return { data }
      }
      return { data: [] }
    } } } })
    await state.load('server').synchronizeInBackground({ syncProxy: false })
    assert.deepEqual(state.storage.domains, [])
    assert.deepEqual(state.storage.registryCache.backend, [])
    assert.equal(state.storage.registryCache.countryCode, countryCode)
    assert.deepEqual(state.storage.serviceErrors, [])
  })
}

const redirectResponse = (state, url, location, status = 302) => {
  for (const listener of state.headerListeners) {
    const details = { url, statusCode: status, requestId: 'service',
      initiator: state.browser.runtime.getURL('').slice(0, -1),
      responseHeaders: location ? [{ name: 'Location', value: location }] : [],
    }
    listener({ ...details, initiator: 'https://unrelated.example' })
    listener(details)
    listener({ ...details, requestId: 'other', responseHeaders: [{ name: 'Location', value: '/wrong' }] })
  }
  return { type: 'opaqueredirect', status: 0, ok: false, headers: { get: () => null } }
}

for (const firefox of [false, true]) {
  for (const status of [301, 302, 303, 307, 308]) {
    test(`redirect ${status} uses the next host's proxy rule: Firefox=${firefox}`, async () => {
      const urls = []
      const state = fixture({ firefox, storage: { customProxiedDomains: ['next.example'] },
        fetch: async (url, init, { route }) => {
          urls.push(url)
          assert.equal(init.redirect, 'manual')
          if (urls.length === 1) {
            assert.equal(route('first.example'), 'DIRECT')
            return redirectResponse(state, url, 'https://next.example/list', status)
          }
          assert.equal(route('next.example'), 'HTTPS retry.example:443')
          return response(['added.example'])
        },
      })
      const result = await state.load('service-request').requestService('https://first.example/list', Array.isArray, { maxRedirects: 5 })
      assert.deepEqual(urls, ['https://first.example/list', 'https://next.example/list'])
      assert.equal(result.viaProxy, true)
      assert.deepEqual(clone(result.data), ['added.example'])
      assert.equal(state.headerListeners.size, 0)
      assert.equal(state.storage.serviceRouteSnapshot, undefined)
      assert.equal(state.route('other.example'), 'HTTPS normal.example:443')
    })
  }
}

for (const hops of [5, 6]) {
  test(`redirect chain accepts five hops and stops before a sixth target: ${hops}`, async () => {
    let calls = 0
    const state = fixture({ fetch: async (url, init) => {
      assert.equal(init.redirect, 'manual')
      const hop = Number(new URL(url).pathname.slice(1))
      calls++
      return hop === hops ? response([]) : redirectResponse(state, url, `/${hop + 1}`)
    } })
    const pending = state.load('service-request').requestService('https://api.example/0', Array.isArray, { maxRedirects: 5 })
    if (hops === 5) await pending
    else await assert.rejects(pending, /Redirect limit/)
    assert.equal(calls, 6)
    assert.equal(state.headerListeners.size, 0)
    assert.deepEqual(state.settings().value, state.original)
  })
}

for (const [location, expected] of [['/start', /cycle/], [null, /no Location/], ['data:text/plain,[]', /HTTP or HTTPS/]]) {
  test(`invalid redirect does not retry its chain: ${location}`, async () => {
    let calls = 0
    const state = fixture({ fetch: async url => { calls++; return redirectResponse(state, url, location) } })
    await assert.rejects(state.load('service-request').requestService('https://api.example/start', Array.isArray, { maxRedirects: 5 }), expected)
    assert.equal(calls, 1)
    assert.equal(state.headerListeners.size, 0)
    assert.deepEqual(state.settings().value, state.original)
  })
}

test('default service requests still reject redirects', async () => {
  let calls = 0
  const state = fixture({ fetch: async (url, init) => {
    calls++
    assert.equal(init.redirect, 'error')
    assert.equal(state.headerListeners.size, 0)
    throw new Error('Redirect rejected')
  } })
  await assert.rejects(state.load('service-request').requestService('https://api.example/list', Array.isArray), /Redirect rejected/)
  assert.equal(calls, 2)
})

test('manual redirects wait for delayed browser headers', async () => {
  let calls = 0
  const state = fixture({ fetch: async url => {
    if (++calls === 1) {
      setTimeout(() => redirectResponse(state, url, '/final'), 5)
      return { type: 'opaqueredirect', status: 0, ok: false }
    }
    return response([])
  } })
  await state.load('service-request').requestService('https://api.example/start', Array.isArray, { maxRedirects: 5 })
  assert.equal(calls, 2)
  assert.equal(state.headerListeners.size, 0)
})

for (const failure of ['timeout', 'cancel', 'exclusion']) {
  test(`redirect routing preserves ${failure} and removes listeners`, async () => {
    let calls = 0
    const state = fixture({ fastTimeout: true, storage: { ignoredHosts: failure === 'exclusion' ? ['next.example'] : [] },
      fetch: async (url, init, { listeners, storage }) => {
        calls++
        if (calls === 1) return redirectResponse(state, url, 'https://next.example/list')
        if (failure === 'exclusion') throw new Error('offline')
        return new Promise((resolve, reject) => {
          init.signal.addEventListener('abort', () => reject(new Error('aborted')))
          if (failure === 'cancel') {
            storage.useProxy = false
            for (const listener of listeners) listener({ useProxy: { newValue: false } })
          }
        })
      },
    })
    await assert.rejects(state.load('service-request').requestService('https://first.example/list', Array.isArray,
      { maxRedirects: 5, allowProxyRetry: failure === 'exclusion' }),
    failure === 'timeout' ? /Timeout/ : failure === 'cancel' ? /Cancelled/ : /exclusion/)
    assert.equal(calls, 2)
    assert.equal(state.headerListeners.size, 0)
    assert.equal(state.storage.serviceRouteSnapshot, undefined)
  })
}

test('large registry updates yield, merge duplicates, and preserve unchanged storage', async () => {
  const names = Array.from({ length: 50000 }, (_, index) => `site${index}.example`)
  let primary = [...names, 'bad/path', names[0]]
  let ticked = false
  const state = fixture({ storage: { currentRegionCode: 'RU', registryRegionCode: 'RU' },
    mocks: { 'service-request': { requestService: async url => {
      if (url.includes('ct-domains')) {
        setTimeout(() => { ticked = true }, 0)
        return { data: primary }
      }
      if (url.includes('/api/config/')) return { data: {} }
      return { data: url.includes('/api/domains/') ? [names[0], 'backend.example'] : [] }
    } } },
  })
  const sync = () => state.load('server').synchronizeInBackground({ syncProxy: false })
  await sync()
  assert.equal(ticked, true)
  assert.deepEqual(state.storage.domains, [...names, 'backend.example'])
  assert.equal(state.storage.registryStatus.skipped, 1)
  const saved = state.storage.domains
  await sync()
  assert.equal(state.storage.domains, saved)
  primary = [...names.slice(1), 'changed.example']
  await sync()
  assert.deepEqual(state.storage.domains, [...primary, names[0], 'backend.example'])
  assert.equal(state.storage.registryStatus.skipped, 0)
})

test('registry HEAD checks preserve domain storage and clear previous errors', async () => {
  const calls = []
  const custom = 'https://custom.example/list'
  const state = fixture({ storage: { currentRegionCode: 'RU' }, fetch: async (url, init) => {
    calls.push([url, init.method])
    return { ok: true, headers: { get: () => '"1"' }, json: async () => {
      assert.notEqual(init.method, 'HEAD')
      if (url.includes('/api/config/')) return { customRegistryUrl: custom }
      if (url.includes('disseminators')) return []
      return url === custom ? [{ domains: ['custom.example'] }] : ['primary.example']
    } }
  } })
  const sync = () => state.load('server').synchronizeInBackground({ syncProxy: false })
  await sync()
  const domains = state.storage.domains
  const validators = clone(state.storage.registryCache.validators)
  let writes = 0
  const set = state.browser.storage.local.set
  state.browser.storage.local.set = async values => {
    if ('domains' in values || 'registryCache' in values) writes++
    await set(values)
  }
  state.storage.registryStatus = { state: 'unavailable', error: 'old failure' }
  calls.length = 0
  await sync()
  assert.equal(writes, 0)
  assert.equal(state.storage.domains, domains)
  assert.deepEqual(state.storage.registryCache.validators, validators)
  assert.equal(state.storage.registryStatus.error, '')
  assert.equal(calls.filter(([, method]) => method === 'HEAD').length, 3)
  assert.equal(calls.filter(([, method]) => method === 'GET').length, 2) // Config and ORI.
})

for (const status of [404, 410, 403, 500]) {
  test(`HTTP ${status} controls proxy retry and preserves the original route`, async () => {
    let calls = 0
    const state = fixture({ fetch: async () => { calls++; return { ok: false, status } } })
    const error = await state.load('service-request').requestService('https://api.example/list', Array.isArray)
      .then(() => assert.fail('Expected HTTP error'), error => error)
    assert.equal(state.load('request-diagnostics').requestFailure(error).httpStatus, status)
    assert.equal(calls, [404, 410].includes(status) ? 1 : 2)
    assert.deepEqual(state.settings().value, state.original)
    assert.equal(state.storage.serviceRouteSnapshot, undefined)
  })
}

test('a missing registry proceeds to its next mirror without a proxy retry', async () => {
  const calls = []
  const state = fixture({ fetch: async url => {
    calls.push(url)
    return url.includes('ctreserve') ? { ok: false, status: 404 } : response(['good.example'])
  } })
  const result = await state.load('service-mirrors').requestMirroredService({}, 'registry', Array.isArray, { countryCode: 'RU' })
  assert.deepEqual(result.data, ['good.example'])
  assert.equal(calls.length, 2)
  assert.match(calls[1], /109\.61\.17\.39/)
  assert.equal(state.events.includes('knock'), false)
  assert.equal(state.storage.serviceRouteSnapshot, undefined)
})
