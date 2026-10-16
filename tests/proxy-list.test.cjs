const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')

const fixture = initial => {
  const storage = { ...initial }
  const browser = { storage: { local: {
    get: async defaults => ({ ...defaults, ...storage }),
    set: async values => Object.assign(storage, JSON.parse(JSON.stringify(values))),
  } } }
  return { storage, ...load('background/proxy-list', { 'browser-api': { default: browser } }) }
}

test('legacy and managed proxies share the list without silently changing selection', async () => {
  const state = fixture({ customProxyProtocol: 'HTTP', customProxyServerURI: 'Proxy.Example:8080', proxyServerURI: 'builtin.example:443' })
  const result = await state.readProxyState()
  assert.equal(result.proxies[0].host, 'proxy.example')
  assert.deepEqual(Array.from(result.selectedProxyIds), ['legacy'])
  assert.equal(result.builtin.host, 'builtin.example')
  assert.deepEqual(Array.from((await fixture({ customProxyServerURI: 'bad' }).readProxyState()).selectedProxyIds), [])
  assert.equal((await fixture().readProxyState()).builtin.host, undefined)
  const { selectedProxyIds } = await fixture({ useOwnProxy: false,
    customProxyProtocol: 'HTTP', customProxyServerURI: 'old.example:80' }).readProxyState()
  assert.deepEqual(Array.from(selectedProxyIds), ['builtin'])
})

test('add, edit, select multiple, and delete preserve unrelated proxies and empty selection', async () => {
  const state = fixture()
  await state.updateProxyList({ operation: 'save', proxy: { id: 'one', protocol: 'HTTP', host: 'one.example', port: 80 } })
  await state.updateProxyList({ operation: 'save', proxy: { id: 'two', protocol: 'SOCKS5', host: '::1', port: 1080 } })
  await state.updateProxyList({ operation: 'select', ids: ['two', 'builtin', 'one', 'one'] })
  assert.deepEqual(state.storage.selectedProxyIds, ['two', 'builtin', 'one'])
  await state.updateProxyList({ operation: 'save', proxy: { ...state.storage.proxies[0], name: '<b>name</b>' } })
  assert.equal(state.storage.proxies[0].name, '<b>name</b>')
  state.storage.proxyChecks = { two: { status: 'failed' }, one: { status: 'ok' } }
  state.storage.proxyFailures = { two: { retryAt: 1000 } }
  await state.updateProxyList({ operation: 'remove', ids: ['two'] })
  assert.equal(state.storage.proxyChecks.two, undefined)
  assert.equal(state.storage.proxyChecks.one.status, 'ok')
  assert.equal(state.storage.proxyFailures.two, undefined)
  assert.deepEqual(state.storage.selectedProxyIds, ['builtin', 'one'])
  await state.updateProxyList({ operation: 'select', ids: [] })
  assert.deepEqual(Array.from((await state.readProxyState()).selectedProxyIds), [])
  await assert.rejects(state.updateProxyList({ operation: 'remove', ids: ['builtin'] }))
  await assert.rejects(state.updateProxyList({ operation: 'select', ids: ['missing'] }))
  await assert.rejects(state.updateProxyList({ operation: 'save', proxy: { id: 'duplicate', protocol: 'HTTP', host: 'one.example', port: 80 } }))
  assert.equal(state.storage.proxies.length, 1)
  await state.updateProxyList({ operation: 'toggle', id: 'one', selected: true })
  await state.updateProxyList({ operation: 'toggle', id: 'builtin', selected: true })
  assert.deepEqual(state.storage.selectedProxyIds, ['one', 'builtin'])
})

test('proxy backups migrate legacy endpoints and reject invalid selections', () => {
  const { validateSettings } = load('background/settings-data')
  const state = validateSettings({ useOwnProxy: true, customProxyProtocol: 'SOCKS5',
    customProxyServerURI: 'proxy.example:1080' })
  assert.equal(state.proxies[0].id, 'legacy')
  assert.deepEqual(Array.from(state.selectedProxyIds), ['legacy'])
  const restored = validateSettings({ formatVersion: 1, settings: state })
  assert.equal(restored.proxies[0].host, 'proxy.example')
  for (const selectedProxyIds of [false, null, '', ['missing']]) {
    assert.throws(() => validateSettings({ proxies: [], selectedProxyIds }))
  }
})
