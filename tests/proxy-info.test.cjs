const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const ui = require('./render.cjs')
const { proxyFingerprint } = load('background/proxy-check-data')
const plain = value => JSON.parse(JSON.stringify(value))

const fixture = async () => {
  const proxy = { id: 'one', name: 'My proxy', protocol: 'HTTP', host: 'proxy.example', port: 8080,
    username: 'alice', password: 'secret' }
  const storage = { proxyChecks: { one: { status: 'ok', checkedAt: 123456,
    fingerprint: await proxyFingerprint(proxy), exitIP: '8.8.8.8', exitCountry: 'US', serverCountry: 'DE' } } }
  let enabled = true
  let route = { type: 'proxy', proxies: [proxy, { ...proxy, id: 'two' }] }
  let revision = 0
  let beforeRead = () => {}
  const api = load('background/proxy-info', {
    'browser-api': { default: { storage: { local: { get: async defaults => { beforeRead(); return { ...defaults, ...storage } } } } } },
    'proxy-route': { proxyAllowed: async () => enabled, getRouteRevision: () => revision },
    proxy: { default: { getRouteForHost: async () => route } },
    registry: { default: { getDomainCount: async () => 1 } },
  }, { fetch: () => { throw new Error('Popup must not request the network') } })
  return { ...api, proxy, storage, setEnabled: value => { enabled = value },
    setRoute: value => { route = value; revision++ }, beforeRead: fn => { beforeRead = fn } }
}

test('public route information exposes the planned primary and last checked exit, without secrets', async () => {
  const state = await fixture()
  const info = plain(await state.describeProxyRoute({ url: 'https://protected.example/path' }))
  assert.equal(info.proxy.name, 'My proxy')
  assert.equal(info.fallbackCount, 1)
  assert.equal(info.check.exitIP, '8.8.8.8')
  assert.equal(info.check.exitCountry, 'US')
  assert.equal(info.check.checkedAt, 123456)
  assert.doesNotMatch(JSON.stringify(info), /alice|secret|fingerprint|username|password|serverCountry/)
  state.proxy.password = 'changed'
  assert.equal((await state.describeProxyRoute({ url: 'protected.example' })).check, null)
})

test('direct, blocked, and inactive routes never show an unrelated proxy IP', async () => {
  const state = await fixture()
  for (const type of ['direct', 'blocked']) {
    state.setRoute({ type, proxies: [] })
    const info = await state.describeProxyRoute({ url: 'protected.example' })
    assert.equal(info.type, type)
    assert.equal(info.proxy, null)
    assert.equal(info.check, null)
  }
  state.setEnabled(false)
  assert.deepEqual(plain(await state.describeProxyRoute({ url: 'protected.example' })), { type: 'disabled' })
  assert.deepEqual(plain(await state.describeProxyRoute({ url: 'about:blank' })), { type: 'unavailable' })
})

test('Censor Tracker route information omits endpoints and exit IPs', async () => {
  const state = await fixture()
  state.proxy.id = 'builtin'
  state.storage.proxyChecks.builtin = state.storage.proxyChecks.one
  const info = plain(await state.describeProxyRoute({ url: 'protected.example' }))
  assert.deepEqual(info.proxy, { id: 'builtin', name: 'My proxy' })
  assert.equal(info.check.exitIP, '')
  assert.equal(info.check.exitCountry, 'US')
})

test('route descriptions discard a snapshot if routing changes while metadata is read', async () => {
  const state = await fixture()
  state.beforeRead(() => { state.beforeRead(() => {}); state.setRoute({ type: 'blocked', proxies: [] }) })
  const info = await state.describeProxyRoute({ url: 'protected.example' })
  assert.equal(info.type, 'blocked')
  assert.equal(info.proxy, null)
})

test('popup renders text safely and clears the old exit when another extension takes proxy control', async () => {
  let info = { type: 'proxy', proxy: { name: '<img src=x>', protocol: 'HTTP', host: 'proxy.example', port: 80 },
    check: { status: 'ok', checkedAt: 123456, exitIP: '8.8.8.8', exitCountry: 'US' },
    region: '<script>bad()</script>', domainCount: 42, fallbackCount: 1 }
  const state = ui.storageFixture()
  const listeners = new Set()
  state.browser.proxy = { settings: { onChange: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) } } }
  const { ProxyInfo } = ui.moduleFor('pages/popup/proxy-info', {
    'browser-api': { default: state.browser },
    'background-rpc': { callBackground: async () => info },
  }, { fetch: () => { throw new Error('Popup must not request the network') } })
  const view = ui.testing.render(ui.h(ProxyInfo, { url: 'https://protected.example', open: true, hidden: false, onToggle() {} }))
  const summary = ui.byId('proxyRouteSummary'), exit = ui.byId('proxyRouteExit'), details = ui.byId('proxyingDetailsText')
  await ui.testing.waitFor(() => assert.match(summary.textContent, /<img src=x>/))
  assert.match(exit.textContent, /8\.8\.8\.8.*United States/)
  assert.match(details.textContent, /<script>bad\(\)<\/script>/)
  assert.equal(details.querySelector('script'), null)
  assert.match(details.textContent, /popupRouteCheckedAt/)
  info = { ...info, proxy: { ...info.proxy, name: 'Censor Tracker' } }
  for (const listener of listeners) listener()
  await ui.testing.waitFor(() => assert.match(summary.textContent, /Censor Tracker/))
  assert.match(exit.textContent, /proxyExitCountry.*United States \(US\)/)
  assert.doesNotMatch(exit.textContent, /8\.8\.8\.8/)
  assert.doesNotMatch(details.textContent, /proxy\.example|HTTP|popupRouteCheckedAt|proxyStatus_|popupRouteFallbacks/)
  info = { type: 'disabled' }
  for (const listener of listeners) listener({ levelOfControl: 'controlled_by_other_extensions' })
  await ui.testing.waitFor(() => assert.match(summary.textContent, /popupRoute_disabled/))
  assert.equal(exit.textContent, '')
  view.unmount()
  assert.equal(listeners.size, 0)
  assert.equal(state.listeners.size, 0)
})
