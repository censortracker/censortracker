const assert = require('node:assert/strict')
const { test } = require('node:test')
const vm = require('node:vm')
const load = require('./load.cjs')
const url = 'https://page.example/path?private=token'
const fixture = (firefox = false, entries = ['https://page.example/same', 'https://cdn.example/asset',
  'https://ПРИМЕР.РФ/api', 'https://cdn.example./other', 'http://10.0.0.1/private', 'data:text/plain,x']) => {
  const storage = {customProxiedDomains: ['saved.example'], ignoredHosts: ['excluded.example'], useProxy: false}
  const injections = []
  const listeners = new Set()
  let currentUrl = url
  const globals = {location: {href: url}, performance: {getEntriesByType: () => entries.map(name => ({name}))}}
  const browser = {isFirefox: firefox, tabs: {
    onUpdated: {addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn)},
    get: async () => ({url: currentUrl}),
    executeScript: async (tabId, options) => { injections.push({tabId, ...options}); return [vm.runInNewContext(options.code, {...globals, URL})] },
  }, scripting: {executeScript: async options => { injections.push(options); return [{result: options.func()}] }},
  storage: {local: {get: async defaults => ({...defaults, ...storage}), set: async values => Object.assign(storage, values)}}}
  const api = load('background/related-domains', {'browser-api': {default: browser},
    'proxy-route': {withProxyLock: work => work(), proxyAllowed: async () => storage.useProxy},
    proxy: {default: {setProxyInBackground: async () => false}},
  }, {...globals, setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 20))})
  return {...api, storage, injections, browser, listeners, navigate: value => { currentUrl = value }}
}

for (const firefox of [false, true]) {
  test(`explicit page inspection returns only normalized public hostnames, Firefox=${firefox}`, async () => {
    const state = fixture(firefox)
    assert.equal(state.injections.length, 0)
    assert.deepEqual(Array.from(await state.findRelatedDomains({tabId: 1, url})), ['cdn.example', 'xn--e1afmkfd.xn--p1ai'])
    assert.equal(state.injections.length, 1)
    assert.equal(state.listeners.size, 0)
    assert.deepEqual(Array.from(state.storage.customProxiedDomains), ['saved.example'])
    if (firefox) assert.equal(state.injections[0].frameId, 0)
    else assert.deepEqual(Array.from(state.injections[0].target.frameIds), [0])
    state.navigate('https://new.example/')
    await assert.rejects(state.findRelatedDomains({tabId: 1, url}), /changed/)
    assert.equal(state.injections.length, 1)
  })
}

test('page scans are bounded and discard navigation during injection or timed-out results', async () => {
  const state = fixture(false, Array.from({length: 3000}, (_,i) => 'https://cdn' + i + '.example/a'))
  assert.equal((await state.findRelatedDomains({tabId: 1, url})).length, 200)
  state.browser.scripting.executeScript = async () => {
    state.navigate('https://new.example/')
    return [{result: {url, hosts: ['stale.example']}}]
  }
  await assert.rejects(state.findRelatedDomains({tabId: 1, url}), /changed/)
  state.navigate(url)
  state.browser.scripting.executeScript = async () => {
    for (const listener of state.listeners) listener(1, {status: 'loading'})
    return [{result: {url, hosts: ['stale.example']}}]
  }
  await assert.rejects(state.findRelatedDomains({tabId: 1, url}), /changed/)
  assert.equal(state.listeners.size, 0)
  state.browser.scripting.executeScript = () => new Promise(() => {})
  await assert.rejects(state.findRelatedDomains({tabId: 1, url}), /timed out/)
  assert.equal(state.listeners.size, 0)
  for (const args of [{tabId: -1, url}, {tabId: 1, url: 'about:blank'}, {tabId: 1, url: 'https://' + 'a'.repeat(9000)}]) {
    await assert.rejects(state.findRelatedDomains(args))
  }
})

test('reviewed selections are one bounded write, preserve exclusions, and do not enable proxy use', async () => {
  const state = fixture()
  assert.equal(await state.addRelatedDomains(['cdn.example', 'ПРИМЕР.РФ', 'child.excluded.example', '10.0.0.1']), 2)
  assert.deepEqual(Array.from(state.storage.customProxiedDomains), ['saved.example', 'cdn.example', 'xn--e1afmkfd.xn--p1ai'])
  assert.deepEqual(state.storage.ignoredHosts, ['excluded.example'])
  assert.equal(state.storage.useProxy, false)
  for (const input of [[], Array(201).fill('example.com'), ['example.com/path'], ['user@example.com'], ['10.0.0.1']]) {
    await assert.rejects(state.addRelatedDomains(input))
  }
  state.storage.useProxy = true
  await assert.rejects(state.addRelatedDomains(['other.example']), /could not be applied/)
})
