const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')

function fixture(dataConsent) {
  const state = { dataConsent }
  const listeners = new Set()
  const events = []
  const browser = {
    runtime: { getURL: name => `moz-extension://test/${name}`,
      OnInstalledReason: { INSTALL: 'install', UPDATE: 'update' } },
    tabs: { query: async () => [], create: async value => events.push(['tab', value.url]) },
    alarms: { clear: async () => {}, create: async () => {} },
    storage: { local: {
      get: async keys => typeof keys === 'string' ? { [keys]: state[keys] } : { ...keys, ...state },
      set: async values => {
        const changes = Object.fromEntries(Object.entries(values).map(([key, value]) =>
          [key, { oldValue: state[key], newValue: value }]))
        Object.assign(state, structuredClone(values))
        for (const listener of listeners) listener(changes, 'local')
      },
      remove: async key => { delete state[key] },
    }, onChanged: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) } },
  }
  const mocks = { 'browser-api': { default: browser } }
  return { state, events, browser, listeners, mocks,
    change: value => browser.storage.local.set({ dataConsent: value }),
    api: load('background/data-consent', mocks) }
}
const granted = { version: 1, accepted: true }
const flush = () => new Promise(resolve => setImmediate(resolve))

for (const value of [undefined, null, {}, { version: 0, accepted: true },
  { version: 1, accepted: 'true' }, { version: 1, accepted: false }]) {
  test(`invalid or declined consent blocks requests: ${JSON.stringify(value)}`, async () => {
    const state = fixture(value)
    let calls = 0
    const { requestText } = load('background/request', state.mocks,
      { fetch: async () => { calls++; return new Response('unexpected') } })
    await assert.rejects(requestText('https://example.com'), { name: 'ConsentRequiredError' })
    assert.equal(calls, 0)
    assert.equal(state.listeners.size, 0)
  })
}

test('consent permits reading the full response and releases its listener', async () => {
  const state = fixture(granted)
  const { requestText } = load('background/request', state.mocks,
    { fetch: async () => new Response('allowed') })
  assert.equal(await requestText('https://example.com'), 'allowed')
  assert.equal(state.listeners.size, 0)
})

test('revocation cancels a response body and remains cancelled after reacceptance', async () => {
  const state = fixture(granted)
  let signal
  const { requestText } = load('background/request', state.mocks, {
    fetch: async (url, options) => {
      signal = options.signal
      return { ok: true, body: { getReader: () => ({ read: () => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      }) }) } }
    },
  })
  const pending = requestText('https://example.com')
  const rejected = assert.rejects(pending, { name: 'ConsentRequiredError' })
  await flush()
  await state.change({ version: 1, accepted: false })
  await state.change(granted)
  await rejected
  assert.equal(signal.aborted, true)
  assert.equal(state.listeners.size, 0)
})

test('a stale consent read cannot start a request after revocation', async () => {
  const state = fixture(granted)
  let release
  state.browser.storage.local.get = () => new Promise(resolve => { release = resolve })
  let calls = 0
  const pending = state.api.withDataConsent(async () => { calls++ })
  const rejected = assert.rejects(pending, { name: 'ConsentRequiredError' })
  await state.change(null)
  release({ dataConsent: granted })
  await rejected
  assert.equal(calls, 0)
})

test('localhost uses the same consent gate and cancels Axios on withdrawal', async t => {
  const state = fixture(null)
  const axios = require('axios')
  const adapter = axios.defaults.adapter
  t.after(() => { axios.defaults.adapter = adapter })
  let signal
  let calls = 0
  axios.defaults.adapter = async options => {
    calls++; signal = options.signal
    return new Promise((resolve, reject) => signal.addEventListener('abort',
      () => reject(new Error('cancelled')), { once: true }))
  }
  const client = load('background/localproxy', state.mocks).default
  await assert.rejects(client.ping(), { name: 'ConsentRequiredError' })
  assert.equal(calls, 0)
  await state.change(granted)
  const pending = client.ping()
  const rejected = assert.rejects(pending, { name: 'ConsentRequiredError' })
  await flush()
  await state.change(null)
  await rejected
  assert.equal(signal.aborted, true)
})

function lifecycle(values = {}, globals = {}) {
  const f = fixture(values.dataConsent)
  Object.assign(f.state, values)
  let sync = async () => f.events.push('sync')
  const handlers = load('background/handlers', { ...f.mocks,
    settings: { default: { extensionEnabled: async () => f.state.enableExtension === true } },
    proxy: { default: {
      isEnabled: async () => f.state.useProxy !== false,
      removeProxyInBackground: async () => f.events.push('clear'),
      syncLocalProxy: async () => {},
      setProxy: async () => { if (f.state.useProxy !== false) f.events.push('proxy') },
    } },
    'proxy-check': { stopProxyChecks: async () => f.events.push('stop checks') },
    'proxy-route': { withProxyLock: work => work() },
    'service-mirrors': { scheduleServiceMirrors: async () => f.events.push('mirrors') },
    task: { default: { schedule: async () => f.events.push('alarms') } },
    server: { synchronize: () => sync() },
    'proxy-importer': {}, 'proxy-recovery': {}, registry: {}, ignore: {}, utilities: {},
  }, globals)
  return { ...f, handlers, sync: fn => { sync = fn } }
}

for (const reason of ['install', 'update']) {
  test(`${reason} pauses network functions and shows notices before consent`, async () => {
    const f = lifecycle(reason === 'update' ? { enableExtension: true, useProxy: true } : {})
    await f.handlers.handleInstalled({ reason })
    await f.handlers.handleInstalled({ reason })
    await f.handlers.handleStartup()
    await f.handlers.handleOnAlarm({ name: 'anything' })
    assert.equal(f.events.filter(event => Array.isArray(event)).length, 1)
    assert.equal(f.events.find(event => Array.isArray(event))[1], 'moz-extension://test/notifications.html')
    assert.equal(f.state.consentPromptVersion, undefined)
    assert.equal(f.state['noticeActive:release-21'], true)
    assert.equal(f.events.includes('sync'), false)
    assert.equal(f.events.includes('proxy'), false)
    assert.equal(f.state.enableExtension, reason === 'update' ? true : undefined)
    await f.handlers.setDataConsent(false)
    await f.handlers.handleInstalled({ reason: 'update' })
    assert.equal(f.events.filter(event => Array.isArray(event)).length, 1)
    assert.equal(f.state.dataConsent.accepted, false)
  })
}

test('acceptance saves defaults and repeated clicks return while sync is pending', async () => {
  const f = lifecycle()
  const pending = Promise.withResolvers()
  let calls = 0
  f.sync(() => { calls++; return pending.promise })
  await f.handlers.handleInstalled({ reason: 'install' })
  let accepted = false
  const accept = f.handlers.setDataConsent(true).then(() => { accepted = true })
  try {
    await flush()
    assert.equal(accepted, true)
    assert.equal(f.state.dataConsent.accepted, true)
    assert.equal(f.state.enableExtension, true)
    assert.equal(f.state.useProxy, true)
    assert.equal(f.state.useRegistry, true)
    assert.equal(f.state.showNotifications, true)
    assert.equal(f.state.consentInstallPending, undefined)
    accepted = false
    f.handlers.setDataConsent(true).then(() => { accepted = true })
    await flush()
    assert.equal(accepted, true)
    assert.equal(calls, 1)
  } finally {
    pending.resolve()
    await accept
    await flush()
  }
})

for (const key of ['enableExtension', 'dataConsent']) {
  test(`acceptance reports a failed ${key} write and permits retry`, async () => {
    const f = lifecycle({ consentInstallPending: true })
    const set = f.browser.storage.local.set
    f.browser.storage.local.set = async values => {
      if (Object.hasOwn(values, key)) throw new Error('Storage failed')
      return set(values)
    }
    await assert.rejects(f.handlers.setDataConsent(true), /Storage failed/)
    assert.equal(f.state.dataConsent, undefined)
    assert.equal(f.events.includes('sync'), false)
    f.browser.storage.local.set = set
    await f.handlers.setDataConsent(true)
    await flush()
    assert.equal(f.state.dataConsent.accepted, true)
    assert.equal(f.events.filter(event => event === 'sync').length, 1)
  })
}

for (const name of ['Error', 'ConsentRequiredError']) {
  test(`background ${name} is handled and later acceptance resumes`, async () => {
    const errors = []
    const f = lifecycle({ enableExtension: true, useProxy: true },
      { console: { ...console, error: (...args) => errors.push(args) } })
    const error = Object.assign(new Error('Sync failed'), { name })
    f.sync(async () => { throw error })
    await f.handlers.setDataConsent(true)
    await flush()
    assert.equal(errors.length, name === 'Error' ? 1 : 0)
    if (errors.length) assert.equal(errors[0][1], error)
    await f.handlers.setDataConsent(false)
    assert.equal(f.events.at(-1), 'clear')
    f.sync(async () => f.events.push('sync'))
    await f.handlers.setDataConsent(true)
    await flush()
    assert.equal(f.events.filter(event => event === 'sync').length, 1)
  })
}

test('fresh install preserves existing disabled choices', async () => {
  const f = lifecycle({ consentInstallPending: true, useRegistry: false, showNotifications: false })
  await f.handlers.setDataConsent(true)
  assert.equal(f.state.enableExtension, true)
  assert.equal(f.state.useProxy, true)
  assert.equal(f.state.useRegistry, false)
  assert.equal(f.state.showNotifications, false)
  await flush()
})

test('acceptance preserves disabled choices and revocation preserves lists', async () => {
  const f = lifecycle({ enableExtension: false, useProxy: false, ignoredHosts: ['private.example'] })
  await f.handlers.setDataConsent(true)
  await flush()
  assert.equal(f.events.includes('sync'), false)
  assert.equal(f.events.includes('proxy'), false)
  await f.handlers.setDataConsent(false)
  assert.equal(f.state.enableExtension, false)
  assert.equal(f.state.useProxy, false)
  assert.deepEqual(f.state.ignoredHosts, ['private.example'])
})

test('revocation is written and clears the proxy while acceptance is still resuming', async () => {
  const f = lifecycle({ enableExtension: true, useProxy: true })
  let release
  f.sync(() => new Promise(resolve => { release = resolve }))
  const accept = f.handlers.setDataConsent(true)
  await flush()
  const revoke = f.handlers.setDataConsent(false)
  await flush()
  assert.equal(f.state.dataConsent.accepted, false)
  assert.equal(f.events.at(-1), 'clear')
  release()
  await Promise.all([accept, revoke])
  assert.equal(f.events.at(-1), 'clear')
})

test('settings import and export cannot supply consent', () => {
  const { validateSettings } = load('background/settings-data')
  const result = validateSettings({ formatVersion: 1,
    settings: { enableExtension: true, dataConsent: granted } })
  assert.equal(Object.hasOwn(result, 'dataConsent'), false)
  assert.equal(result.enableExtension, true)
})
