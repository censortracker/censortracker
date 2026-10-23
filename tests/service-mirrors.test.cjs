const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const plain = value => JSON.parse(JSON.stringify(value))
const config = mirrors => ({ formatVersion: 1, mirrors })

function fixture(options = {}) {
  const storage = { dataConsent: { version: 1, accepted: true }, enableExtension: true, ...options.storage }
  const listeners = new Set()
  const alarms = new Map()
  const requests = []
  const browser = {
    storage: {
      local: {
        get: async keys => {
          if (typeof keys === 'string') return plain({ [keys]: storage[keys] })
          return plain({ ...keys, ...storage })
        },
        set: async values => Object.assign(storage, plain(values)),
      },
      onChanged: { addListener: listener => listeners.add(listener) },
    },
    alarms: {
      get: async name => alarms.get(name),
      create: async (name, settings) => alarms.set(name, plain(settings)),
      clear: async name => alarms.delete(name),
    },
  }
  const mocks = {
    'browser-api': { default: browser },
    'service-request': { requestService: async (url, validate, settings = {}) => {
      requests.push({ url, settings })
      const result = options.request ? await options.request(url, settings) : { data: config({}) }
      if (!validate(result.data)) throw new Error('Invalid response')
      return result
    } },
  }
  const reload = () => load('background/service-mirrors', mocks)
  return { api: reload(), storage, listeners, alarms, requests, reload }
}

test('the format ignores unknown fields and countries, and removes duplicate URLs', () => {
  const { validateServiceMirrors } = fixture().api
  assert.deepEqual(plain(validateServiceMirrors(config({
    geoip: ['https://geo.example/iso', 'https://geo.example/iso'],
    config: ['https://api.example/{country}/'], domains: [],
    registry: { RU: [], BY: ['https://registry.example/by.json'], PL: null, ru: null },
    future: null,
  }))), {
    geoip: ['https://geo.example/iso'], config: ['https://api.example/{country}/'],
    domains: [], registry: { RU: [], BY: ['https://registry.example/by.json'] },
  })
  assert.deepEqual(plain(validateServiceMirrors(config({}))), {})
})

test('invalid versions, known fields, URL schemes, credentials and templates reject the file', () => {
  const { validateServiceMirrors } = fixture().api
  const invalid = [null, [], {}, { formatVersion: 2, mirrors: {} },
    config(null), config([]), config({ geoip: null }), config({ registry: [] }),
    config({ registry: { RU: null } }), config({ config: ['https://api.example/{other}/'] })]
  for (const url of [null, 123, '', 'not a URL', 'http://api.example/',
    'https://user:pass@api.example/', 'https://user@api.example/',
    'https://api.example/#', 'https://api.example/#fragment',
    ' https://api.example/', 'https://api.example/{country}/']) {
    invalid.push(config({ geoip: [url] }))
  }
  for (const data of invalid) assert.throws(() => validateServiceMirrors(data))
})

test('built-in endpoints precede additions, country templates expand, and duplicates merge', () => {
  const { getServiceUrls } = fixture().api
  const mirrors = { proxyList: ['https://cozyquokka.net/api/proxy-list/', 'https://proxy.example'],
    config: ['https://api.example/{country}/{country}/'], domains: ['https://api.example/{country}/'],
    registry: { RU: ['https://109.61.17.39/api/v3/ct-domains/', 'https://registry.example/ru.json'], PL: ['https://registry.example/pl.json'] } }
  assert.deepEqual(plain(getServiceUrls(mirrors, 'proxyList')), [
    'https://cozyquokka.net/api/proxy-list/', 'https://proxy.example/',
  ])
  assert.deepEqual(plain(getServiceUrls(mirrors, 'config', 'by')), [
    'https://cozyquokka.net/api/config/BY/', 'https://api.example/BY/BY/',
  ])
  assert.deepEqual(plain(getServiceUrls(mirrors, 'domains', 'RU')), [
    'https://cozyquokka.net/api/domains/RU/', 'https://api.example/RU/',
  ])
  assert.deepEqual(plain(getServiceUrls(mirrors, 'registry', 'ru')), [
    'https://registry.ctreserve.de/api/v3/ct-domains/',
    'https://109.61.17.39/api/v3/ct-domains/', 'https://storage.mwsapis.ru/b-hecqix/ct-domains.json',
    'https://registry.example/ru.json',
  ])
  assert.deepEqual(plain(getServiceUrls(mirrors, 'registry', 'PL')), [])
})

test('a failed or invalid endpoint proceeds to the next mirror with the same request options', async () => {
  const state = fixture({ request: async url => {
    if (url.includes('cozyquokka')) throw new Error('offline')
    return { data: url.includes('bad.example') ? {} : ['blocked.example'] }
  } })
  const result = await state.api.requestMirroredService({ domains: [
    'https://bad.example/{country}/', 'https://good.example/{country}/',
  ] }, 'domains', Array.isArray, { countryCode: 'BY', maxRedirects: 5 })
  assert.deepEqual(result.data, ['blocked.example'])
  assert.deepEqual(state.requests.map(({ url }) => url), [
    'https://cozyquokka.net/api/domains/BY/', 'https://bad.example/BY/', 'https://good.example/BY/',
  ])
  assert.ok(state.requests.every(({ settings }) => settings.maxRedirects === 5))
})

test('GeoIP rejects a proxied result and tries the next direct endpoint', async () => {
  const state = fixture({ request: async url => ({
    data: { countryCode: url.includes('ctreserve') ? 'US' : 'BY' }, viaProxy: url.includes('ctreserve'),
  }) })
  const result = await state.api.requestMirroredService({ geoip: ['https://geo.example/iso'] },
    'geoip', data => Boolean(data.countryCode))
  assert.equal(result.data.countryCode, 'BY')
  assert.ok(state.requests.every(({ settings }) => settings.allowProxyRetry === false))
})

test('successful downloads replace additions, persist across restarts, and allow an empty file', async () => {
  let mirrors = { ori: ['https://ori.example/'] }
  const state = fixture({ storage: { serviceMirrors: { geoip: ['https://old.example/'] }, mirrorsError: 'offline' },
    request: async () => ({ data: config(mirrors) }) })
  await state.api.refreshServiceMirrors()
  assert.equal(state.requests[0].url, state.api.MIRRORS_URL)
  assert.equal(state.requests[0].settings.requireEnabled, true)
  assert.deepEqual(state.storage.serviceMirrors, mirrors)
  assert.equal(state.storage.mirrorsError, '')
  assert.ok(state.storage.mirrorsUpdatedAt >= state.storage.mirrorsCheckedAt)
  state.storage.mirrorsUpdatedAt = 1
  assert.deepEqual(plain(await state.reload().getServiceMirrors()), mirrors)
  assert.equal(state.requests.length, 1)
  mirrors = {}
  await state.api.refreshServiceMirrors()
  assert.deepEqual(state.storage.serviceMirrors, {})
})

test('download failures keep the cache and record the attempt without a successful update', async () => {
  for (const failure of ['offline', 'HTTP 404', 'Invalid JSON', 'version', 'invalid URL']) {
    const state = fixture({ storage: { serviceMirrors: { ori: ['https://cached.example/'] }, mirrorsUpdatedAt: 1 },
      request: async () => {
        if (failure === 'version') return { data: { formatVersion: 2, mirrors: {} } }
        if (failure === 'invalid URL') return { data: config({ ori: ['http://invalid.example/'] }) }
        throw new Error(failure)
      } })
    await state.api.refreshServiceMirrors()
    assert.deepEqual(state.storage.serviceMirrors, { ori: ['https://cached.example/'] })
    assert.equal(state.storage.mirrorsUpdatedAt, 1)
    assert.ok(state.storage.mirrorsCheckedAt > 1)
    assert.ok(state.storage.mirrorsError)
  }
})

test('concurrent downloads share one request and snapshot reads wait for that request', async () => {
  let finish
  const state = fixture({ request: () => new Promise(resolve => { finish = resolve }) })
  const first = state.api.refreshServiceMirrors()
  assert.equal(state.api.refreshServiceMirrors(), first)
  let completed = false
  const snapshot = state.api.getServiceMirrors().then(value => { completed = true; return value })
  await new Promise(setImmediate)
  assert.equal(state.requests.length, 1)
  assert.equal(completed, false)
  finish({ data: config({ ori: ['https://ori.example/'] }) })
  await first
  assert.deepEqual(plain(await snapshot), { ori: ['https://ori.example/'] })
})

test('hourly scheduling follows extension enablement and does not depend on useProxy', async () => {
  const state = fixture({ storage: { enableExtension: false, useProxy: false } })
  await state.api.registerServiceMirrors()
  await state.api.refreshServiceMirrors()
  assert.equal(state.alarms.size, 0)
  assert.equal(state.requests.length, 0)
  const change = async (enabled, area = 'local') => {
    state.storage.enableExtension = enabled
    for (const listener of state.listeners) listener({ enableExtension: { newValue: enabled } }, area)
    await new Promise(setImmediate)
  }
  await change(true, 'sync')
  assert.equal(state.requests.length, 0)
  await change(true)
  assert.deepEqual(state.alarms.get(state.api.MIRRORS_ALARM), { periodInMinutes: 60 })
  assert.equal(state.requests.length, 1)
  await state.api.scheduleServiceMirrors()
  assert.equal(state.requests.length, 2)
  await change(false)
  assert.equal(state.alarms.size, 0)
  await state.api.scheduleServiceMirrors()
  assert.equal(state.requests.length, 2)
})
