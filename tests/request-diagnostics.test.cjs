const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const plain = value => JSON.parse(JSON.stringify(value))

function fixture() {
  const event = () => {
    const listeners = new Set()
    return { listeners, addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn),
      emit: data => { for (const fn of listeners) fn(data) } }
  }
  const before = event(), failed = event()
  const api = load('background/request-diagnostics', { 'browser-api': { default: {
    runtime: { getURL: () => 'chrome-extension://test/' },
    webRequest: { onBeforeRequest: before, onErrorOccurred: failed },
  } } })
  const request = (requestId = 'one', extra = {}) => before.emit({ requestId,
    url: 'https://api.ipify.org/?format=json', method: 'GET', initiator: 'chrome-extension://test', ...extra })
  return { ...api, before, failed, request }
}

test('native errors are matched to extension request IDs and listeners are removed', () => {
  for (const netError of ['net::ERR_PROXY_CONNECTION_FAILED', 'NS_ERROR_UNKNOWN_PROXY_HOST']) {
    const state = fixture()
    const stop = state.watchRequest('https://api.ipify.org/?format=json')
    state.request()
    state.failed.emit({ requestId: 'other', error: 'net::ERR_TIMED_OUT' })
    state.failed.emit({ requestId: 'one', error: netError })
    const error = new Error('Failed to fetch')
    stop(error)
    assert.deepEqual(plain(state.requestFailure(new Error('wrapped', { cause: error }))), { code: 'network', netError })
    assert.equal(state.before.listeners.size, 0)
    assert.equal(state.failed.listeners.size, 0)
    stop()
  }
})

test('missing, unrelated, ambiguous and unsafe errors remain generic', () => {
  for (const kind of ['missing', 'tab', 'method', 'two requests', 'two calls', 'unsafe']) {
    const state = fixture()
    const stop = state.watchRequest('https://api.ipify.org/?format=json')
    const second = kind === 'two calls' ? state.watchRequest('https://api.ipify.org/?format=json') : () => {}
    if (kind !== 'missing') state.request('one', kind === 'tab' ? { initiator: 'https://private.example' } : kind === 'method' ? { method: 'POST' } : {})
    if (kind === 'two requests') state.request('two')
    state.failed.emit({ requestId: kind === 'two requests' ? 'two' : 'one', error: kind === 'unsafe' ? 'secret at https://private.example/' : 'net::ERR_TIMED_OUT' })
    const error = new Error('Failed to fetch')
    stop(error); second(error)
    assert.deepEqual(plain(state.requestFailure(error)), { code: 'network' }, kind)
    assert.equal(state.before.listeners.size, 0)
  }
})

test('timeouts, HTTP status and invalid responses survive error wrappers', () => {
  const { requestFailure } = fixture()
  for (const [properties, expected] of [
    [{ name: 'TimeoutError', netError: 'net::ERR_ABORTED' }, { code: 'timeout' }],
    [{ httpStatus: 410 }, { code: 'http', httpStatus: 410 }],
    [{ name: 'SyntaxError' }, { code: 'invalid-response' }],
    [{ code: 'invalid-response' }, { code: 'invalid-response' }],
  ]) {
    const inner = Object.assign(new Error('private error text'), properties)
    assert.deepEqual(plain(requestFailure(new Error('wrapped', { cause: inner }))), expected)
  }
})

test('optional webRequest APIs and rejected listener registration do not break requests', () => {
  const { watchRequest } = load('background/request-diagnostics', { 'browser-api': { default: {} } })
  watchRequest('https://api.ipify.org/')()
  const state = fixture()
  state.failed.addListener = () => { throw new Error('Unavailable API') }
  state.watchRequest('https://api.ipify.org/')()
  assert.equal(state.before.listeners.size, 0)
})

test('exported attempts accept old data and contain no raw URLs or credentials', () => {
  const { checkAttempts } = load('background/proxy-check-data')
  assert.deepEqual(plain(checkAttempts({ status: 'failed' })), [])
  const result = plain(checkAttempts({ attempts: [
    { service: 'api.ipify.org', code: 'network', netError: 'net::ERR_ADDRESS_UNREACHABLE', password: 'secret', message: 'private.example' },
    { service: 'api.myip.com', code: 'http', httpStatus: 503, netError: 'https://private.example/token' },
    { service: 'ipwho.is', code: 'ok' },
  ] }))
  assert.deepEqual(result, [
    { service: 'api.ipify.org', code: 'network', netError: 'net::ERR_ADDRESS_UNREACHABLE' },
    { service: 'api.myip.com', code: 'http', httpStatus: 503 },
  ])
  assert.deepEqual(plain(checkAttempts({ attempts: [{ service: 'private.example', code: 'network' }, null] })), [])
})

test('a native error dispatched after fetch rejection is captured within a bounded wait', async () => {
  const state = fixture()
  const stop = state.watchRequest('https://api.ipify.org/?format=json')
  state.request()
  const error = new TypeError('Failed to fetch')
  const finished = stop(error)
  setTimeout(() => state.failed.emit({ requestId: 'one', error: 'net::ERR_CONNECTION_REFUSED' }), 5)
  await finished
  assert.equal(error.netError, 'net::ERR_CONNECTION_REFUSED')
  assert.equal(state.failed.listeners.size, 0)
  const unknown = new TypeError('Failed to fetch')
  await state.watchRequest('https://api.ipify.org/?format=json')(unknown)
  assert.equal(unknown.netError, undefined)
  assert.equal(state.before.listeners.size, 0)
})
