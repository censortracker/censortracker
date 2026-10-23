const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')

test('local API accepts only successful replies with valid numeric ports', async () => {
  const client = load('background/localproxy', { 'browser-api': { default: {} } }).default
  for (const method of ['ping', 'start']) {
    for (const proxyPort of [1, 10808, 23456, 65535]) {
      client.request = async () => ({ status: 'ok', proxyPort })
      assert.equal(await client[method](), proxyPort)
    }
    for (const proxyPort of [undefined, null, 0, -1, 65536, 1.5, '10808', '80; DIRECT']) {
      client.request = async () => ({ status: 'ok', proxyPort })
      assert.equal(await client[method](), null)
    }
    client.request = async () => null
    assert.equal(await client[method](), null)
    client.request = async () => ({ status: 'error', proxyPort: 10808 })
    assert.equal(await client[method](), null)
    client.request = async () => { throw new Error('offline') }
    assert.equal(await client[method](), null)
  }
})

function fixture(values = {}) {
  const storage = { dataConsent: { version: 1, accepted: true }, useLocalProxy: true, useProxy: true, enableExtension: true, ...values }
  const events = []
  const client = { ping: async () => 23456, start: async () => 34567,
    stop: async () => { events.push('stop') } }
  const browser = { storage: { local: {
    get: async keys => typeof keys === 'string' ? { [keys]: storage[keys] }
      : { ...keys, ...storage },
    set: async values => Object.assign(storage, values),
  } }, notifications: { create: async () => events.push('notify') },
  i18n: { getMessage: () => 'Local proxy is down' } }
  const manager = load('background/proxy', {
    'browser-api': { default: browser },
    localproxy: { default: client },
    settings: { default: { extensionEnabled: async () => storage.enableExtension,
      getName: () => 'CT', getDangerIcon: () => 'icon.png' } },
    'proxy-route': {}, registry: { default: {} },
  }).default
  manager.setProxyInBackground = async () => events.push('apply')
  manager.removeProxyInBackground = async () => events.push('remove')
  return { storage, events, client, manager, browser }
}

test('notification failure does not stop local proxy checks or recovery', async () => {
  const { browser, client, manager, storage, events } = fixture({ localProxyAlive: true })
  browser.notifications.create = async () => { throw new Error('Notifications unavailable') }
  client.ping = async () => null
  assert.equal((await manager.syncLocalProxyInBackground()).alive, false)
  assert.equal(storage.localProxyAlive, false)
  client.ping = async () => 23456
  assert.equal((await manager.syncLocalProxyInBackground()).alive, true)
  assert.deepEqual(events, ['remove', 'apply'])
})

test('local proxy port changes and recovery update routing without repeat notifications', async () => {
  const { storage, events, client, manager } = fixture()
  await manager.syncLocalProxyInBackground()
  assert.equal(storage.localProxyURI, '127.0.0.1:23456')
  assert.equal(storage.localProxyAlive, true)
  assert.equal((await manager.getSelectedProxies())[0].port, 23456)
  await manager.syncLocalProxyInBackground()
  assert.deepEqual(events, ['apply'])
  client.ping = async () => 34567
  await manager.syncLocalProxyInBackground()
  assert.equal(storage.localProxyURI, '127.0.0.1:34567')
  client.ping = async () => null
  await manager.syncLocalProxyInBackground()
  await manager.syncLocalProxyInBackground()
  assert.equal(storage.localProxyURI, null)
  assert.equal(storage.localProxyAlive, false)
  assert.equal((await manager.getSelectedProxies()).length, 0)
  assert.equal(events.filter(e => e === 'notify').length, 1)
  client.ping = async () => 34567
  await manager.syncLocalProxyInBackground()
  assert.equal(events.at(-1), 'apply')
})

test('local mode starts on request and stops when returning to the proxy list', async () => {
  const { storage, events, client, manager } = fixture({ useLocalProxy: false })
  client.ping = async () => null
  await manager.setLocalProxyInBackground(true)
  assert.equal(storage.localProxyURI, '127.0.0.1:34567')
  await manager.setLocalProxyInBackground(false)
  assert.equal(storage.useLocalProxy, false)
  assert.equal(storage.localProxyURI, null)
  assert.equal(storage.localProxyAlive, false)
  assert.deepEqual(events, ['remove', 'apply', 'stop', 'apply'])
})

for (const key of ['useLocalProxy', 'useProxy', 'enableExtension']) {
  test(`local checks do not apply or start a proxy after ${key} is disabled`, async () => {
    const { storage, events, client, manager } = fixture()
    client.ping = async () => { storage[key] = false; return null }
    client.start = async () => { throw new Error('Must not start') }
    await manager.syncLocalProxyInBackground({ startIfMissing: true })
    assert.deepEqual(events, [])
    assert.equal(storage.localProxyURI, undefined)
  })
}
