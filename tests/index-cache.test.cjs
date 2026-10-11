const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')

test('registry writes change revisions atomically and preserve unrelated settings', async () => {
  const writes = []
  const { setRegistryState, registryWrites } = load('background/index-cache', {
    'browser-api': { default: { storage: { local: { set: async state => writes.push(state) } } } },
  })
  let notified = 0
  registryWrites.add(() => { notified++; assert.equal(writes.length, notified) })
  await setRegistryState({ domains: ['one.example'], externalRegistry: null })
  await setRegistryState({ domains: ['two.example'] })
  await setRegistryState({ useRegistry: false })
  assert.equal(writes.length, 3)
  assert.equal(notified, 3)
  assert.ok(writes[0].domainsRevision)
  assert.ok(writes[0].externalRegistryRevision)
  assert.notEqual(writes[0].domainsRevision, writes[1].domainsRevision)
  assert.equal(writes[1].externalRegistryRevision, undefined)
  assert.deepEqual(Object.keys(writes[2]), ['useRegistry'])
})

test('cache failures, blocked opens, and malformed snapshots are cache misses', async () => {
  const valid = { lists: [{ 11: 'one.example' }], count: 1 }
  let mode = 'read'
  let record = { version: 1, revision: 'one', data: valid }
  let closed = 0
  const indexedDB = { open() {
    if (mode === 'denied') throw new Error('Unavailable')
    const request = new EventTarget()
    request.result = {
      addEventListener() {}, close() { closed++ },
      transaction() {
        if (mode === 'transaction') throw new Error('Closed')
        const transaction = new EventTarget()
        transaction.objectStore = () => ({
          get: () => ({ result: record }),
          put: value => { record = value; return { result: '0' } },
        })
        queueMicrotask(() => transaction.dispatchEvent(new Event(mode === 'abort' ? 'abort' : 'complete')))
        return transaction
      },
    }
    queueMicrotask(() => {
      if (mode === 'blocked') request.dispatchEvent(new Event('blocked'))
      if (mode !== 'timeout') request.dispatchEvent(new Event('success'))
    })
    return request
  } }
  const { indexCache } = load('background/index-cache', { 'browser-api': {} }, {
    indexedDB, setTimeout: callback => setTimeout(callback, 5),
  })
  assert.equal(await indexCache('0', 'one'), valid)
  assert.equal(await indexCache('0', ''), null)
  assert.equal(await indexCache('0', 'two'), null)
  for (const value of [
    { ...record, version: 0 }, { ...record, data: null },
    { ...record, data: { lists: [{ 0: 'bad' }], count: 1 } },
    { ...record, data: { lists: [{ 11: 'truncated' }], count: 1 } },
  ]) {
    record = value
    assert.equal(await indexCache('0', 'one'), null)
  }
  await indexCache('0', 'two', valid)
  assert.equal(await indexCache('0', 'two'), valid)
  for (mode of ['denied', 'blocked', 'transaction', 'abort', 'timeout']) {
    assert.equal(await indexCache('0', 'two'), null, mode)
  }
  assert.ok(closed > 0)
  assert.equal(await load('background/index-cache', { 'browser-api': {} }).indexCache('0', 'one'), null)
})

test('startup uses snapshots, and source changes or resets cannot reuse stale rules', async () => {
  const storage = { domainsRevision: 'builtin', externalRegistryRevision: 'external',
    domains: ['builtin.example'], registrySource: { kind: 'custom', url: 'https://source.example', enabled: true },
    externalRegistry: { source: '["custom","https://source.example"]', domains: ['external.example'] } }
  const snapshots = new Map()
  const listeners = new Set()
  const reads = []
  const browser = { storage: { local: {
    get: async defaults => {
      reads.push(Object.keys(defaults))
      return Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, storage[key] ?? value]))
    },
  }, onChanged: { addListener: listener => listeners.add(listener) } } }
  let pauseRead
  const mocks = { 'browser-api': { default: browser }, 'index-cache': {
    registryWrites: new Set(),
    indexCache: async (key, revision, data) => {
      if (data) { snapshots.set(key, { revision, data }); return null }
      const snapshot = snapshots.get(key)
      if (pauseRead) { const pause = pauseRead; pauseRead = null; await pause() }
      return snapshot?.revision === revision ? snapshot.data : null
    },
  } }
  const restart = () => {
    listeners.clear()
    reads.length = 0
    return load('background/registry', mocks, { indexedDB: {} }).default
  }
  const change = values => {
    Object.assign(storage, values)
    for (const listener of listeners) listener(Object.fromEntries(Object.keys(values).map(key => [key, {}])), 'local')
  }
  let registry = restart()
  assert.equal((await registry.getDomainStatus('builtin.example')).blocked, true)
  assert.equal((await registry.getDomainStatus('external.example')).blocked, true)
  registry = restart()
  assert.equal((await registry.getDomainStatus('external.example')).blocked, true)
  assert.ok(reads.every(keys => !keys.includes('domains') && !keys.includes('externalRegistry')))
  change({ registrySource: { ...storage.registrySource, enabled: false } })
  assert.equal((await registry.getDomainStatus('external.example')).blocked, false)
  change({ domainsRevision: 'next', domains: ['next.example'] })
  assert.equal((await registry.getDomainStatus('builtin.example')).blocked, false)
  assert.equal((await registry.getDomainStatus('next.example')).blocked, true)
  registry = restart()
  pauseRead = async () => change({ domainsRevision: 'latest', domains: ['latest.example'] })
  assert.equal((await registry.getDomainStatus('next.example')).blocked, false)
  assert.equal((await registry.getDomainStatus('latest.example')).blocked, true)
  registry = restart()
  delete storage.domains
  delete storage.domainsRevision
  assert.equal((await registry.getDomainStatus('latest.example')).blocked, false)
  assert.ok(reads.some(keys => keys.includes('domains')))
})
