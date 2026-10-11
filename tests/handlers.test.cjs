const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')

function fixture(values = {}, globals = {}, mocks = {}) {
  const storage = { dataConsent: { version: 1, accepted: true }, enableExtension: true, useProxy: true, ...values }
  const events = []
  let queue = Promise.resolve()
  const withProxyLock = operation => {
    const result = queue.then(operation)
    queue = result.catch(() => {})
    return result
  }
  const proxy = {
    isEnabled: async () => storage.useProxy ?? true,
    ping: async () => events.push('knock'),
    requestIncognitoAccess: async () => events.push('permissions'),
    setProxy: async () => events.push('apply'),
    syncLocalProxy: async () => events.push('check local'),
    setProxyInBackground: async () => events.push('apply'),
    removeProxy: async () => events.push('remove'),
    removeProxyInBackground: async () => events.push('remove'),
    disableProxy: async () => { storage.useProxy = false; events.push('preference changed') },
  }
  const browser = { tabs: { query: async () => [{ id: 1 }] },
    storage: { local: { get: async () => ({ ...storage }),
      set: async values => Object.assign(storage, values) } },
    alarms: {
      create: async (name, options) => events.push(['create', name, { ...options }]),
      clear: async name => events.push(['clear', name]),
    } }
  const handlers = load('background/handlers', {
    'browser-api': { default: browser },
    proxy: { default: proxy },
    'proxy-route': { withProxyLock },
    settings: { default: {
      extensionEnabled: async () => storage.enableExtension ?? false,
      setDefaultIcon: () => events.push('enabled icon'),
      setDisableIcon: () => events.push('disabled icon'),
    } },
    ignore: { default: {} }, registry: { default: {} },
    server: {}, task: { default: { schedule: async () => {} } }, utilities: {},
    'proxy-importer': {}, 'proxy-recovery': {},
    'service-mirrors': { MIRRORS_ALARM: 'service-mirrors',
      scheduleServiceMirrors: async () => events.push('schedule mirrors'),
      refreshServiceMirrors: async () => events.push('refresh mirrors') },
    ...mocks,
  }, globals)
  return { storage, events, proxy, browser, handlers, withProxyLock }
}

test('navigation bursts knock once per 30 seconds and still check permissions', async () => {
  let now = 0
  const state = fixture({}, { performance: { now: () => now } })
  await Promise.all(Array.from({ length: 20 }, () => state.handlers.handleBeforeRequest()))
  assert.equal(state.events.filter(event => event === 'knock').length, 1)
  assert.equal(state.events.filter(event => event === 'permissions').length, 20)
  now = 29999
  await state.handlers.handleBeforeRequest()
  assert.equal(state.events.filter(event => event === 'knock').length, 1)
  now = 30000
  await state.handlers.handleBeforeRequest()
  assert.equal(state.events.filter(event => event === 'knock').length, 2)
})

test('startup checks the local proxy before it applies routing', async () => {
  const state = fixture({ useLocalProxy: true })
  await state.handlers.handleStartup()
  assert.deepEqual(state.events, [
    ['create', 'checkLocalProxy', { periodInMinutes: 1 }], 'check local', 'schedule mirrors', 'apply',
  ])
})

test('the mirror alarm starts a refresh', async () => {
  const state = fixture()
  await state.handlers.handleOnAlarm({ name: 'service-mirrors' })
  assert.deepEqual(state.events, ['refresh mirrors'])
})

test('updates with consent show notices once and load mirrors through startup', async () => {
  const state = fixture()
  state.browser.runtime = { getURL: path => `extension://${path}`,
    OnInstalledReason: { INSTALL: 'install', UPDATE: 'update' } }
  state.browser.tabs.create = async tab => state.events.push(['tab', tab.url])
  await state.handlers.handleInstalled({ reason: 'update' })
  assert.deepEqual(state.events, [
    ['tab', 'extension://notifications.html'],
    ['clear', 'checkLocalProxy'], 'check local', 'schedule mirrors', 'apply',
  ])
  await state.handlers.handleInstalled({ reason: 'update' })
  assert.equal(state.events.filter(event => event[0] === 'tab').length, 1)
  assert.equal(state.storage['noticeActive:release-21'], true)
})

test('local proxy alarms follow the latest selected mode', async () => {
  const state = fixture({ useLocalProxy: true })
  await state.handlers.scheduleLocalProxyCheck()
  state.storage.useLocalProxy = false
  await state.handlers.scheduleLocalProxyCheck()
  assert.deepEqual(state.events, [
    ['create', 'checkLocalProxy', { periodInMinutes: 1 }], ['clear', 'checkLocalProxy'],
  ])
})

for (const [handler, key] of [
  ['handleIgnoredHostsChange', 'ignoredHosts'],
  ['handleCustomProxiedDomainsChange', 'customProxiedDomains'],
]) {
  test(`${handler} waits for the routing update`, async () => {
    const state = fixture()
    let release
    let settled = false
    state.proxy.setProxy = () => {
      state.events.push('apply')
      return new Promise(resolve => { release = resolve })
    }
    const pending = state.handlers[handler]({ [key]: { newValue: [] } }, 'local')
      .then(() => { settled = true })
    await new Promise(resolve => setImmediate(resolve))
    try {
      assert.deepEqual(state.events, ['apply'])
      assert.equal(settled, false)
    } finally {
      release?.()
      await pending
    }
    assert.equal(settled, true)
  })
}

test('storage changes reconcile the latest switches without changing user choices', async () => {
  for (const [values, changes, expected] of [
    [{ useProxy: false }, { enableExtension: { newValue: true }, useProxy: { newValue: false } }, ['remove', 'enabled icon']],
    [{ enableExtension: false, useProxy: true }, { enableExtension: { oldValue: true, newValue: false } }, ['remove', 'disabled icon']],
    [{ enableExtension: false, useProxy: false }, { useProxy: { oldValue: true, newValue: false } }, ['remove']],
    [{ enableExtension: undefined }, { enableExtension: { oldValue: true } }, ['remove', 'disabled icon']],
    [{}, { useProxy: { oldValue: false, newValue: true } }, ['apply']],
  ]) {
    const state = fixture(values)
    const before = { ...state.storage }
    await state.handlers.handleStorageChanged(changes, 'local')
    assert.deepEqual(state.events, expected)
    assert.deepEqual(state.storage, before)
  }
})

test('unrelated storage areas and fields do not change proxy routing', async () => {
  const state = fixture()
  for (const area of ['sync', 'session']) {
    await state.handlers.handleStorageChanged({ useProxy: { newValue: false } }, area)
    await state.handlers.handleIgnoredHostsChange({ ignoredHosts: { newValue: [] } }, area)
    await state.handlers.handleCustomProxiedDomainsChange({ customProxiedDomains: { newValue: [] } }, area)
  }
  await state.handlers.handleStorageChanged({ showNotifications: { newValue: false } }, 'local')
  assert.deepEqual(state.events, [])
})

test('removing a manual list updates routing only while proxying is enabled', async () => {
  for (const [handler, key] of [
    ['handleIgnoredHostsChange', 'ignoredHosts'],
    ['handleCustomProxiedDomainsChange', 'customProxiedDomains'],
  ]) {
    const state = fixture()
    await state.handlers[handler]({ [key]: { oldValue: ['example.com'] } }, 'local')
    assert.deepEqual(state.events, ['apply'])
    state.events.length = 0
    state.storage.enableExtension = false
    await state.handlers[handler]({ [key]: { newValue: [] } }, 'local')
    state.storage.enableExtension = true
    state.storage.useProxy = false
    await state.handlers[handler]({ [key]: { newValue: [] } }, 'local')
    assert.deepEqual(state.events, [])
  }
})

test('a queued settings event reads current choices after it acquires the route lock', async () => {
  for (const [previous, current, action] of [[false, true, 'apply'], [true, false, 'remove']]) {
    const state = fixture({ useProxy: previous })
    let release
    const blocked = state.withProxyLock(() => new Promise(resolve => { release = resolve }))
    await new Promise(resolve => setImmediate(resolve))
    const update = state.handlers.handleStorageChanged({ useProxy: { newValue: previous } }, 'local')
    state.storage.useProxy = current
    release()
    await blocked
    await update
    assert.deepEqual(state.events, [action])
  }
})

test('navigation clears the previous site warning icon', async () => {
  for (const warning of ['blocked', 'danger']) {
    let icon = 'default'
    const state = fixture({}, {}, {
      settings: { default: {
        extensionEnabled: async () => true,
        setDefaultIcon: () => { icon = 'default' },
        setBlockedIcon: () => { icon = 'blocked' },
        setDangerIcon: () => { icon = 'danger' },
      } },
      ignore: { default: { contains: async () => false } },
      registry: { default: {
        contains: async url => url.includes('warning') && warning === 'blocked',
        retrieveDisseminator: async url => url.includes('warning') && warning === 'danger'
          ? { url, cooperationRefused: false } : {},
      } },
    })
    state.browser.tabs.TabStatus = { LOADING: 'loading' }
    for (const [host, expected] of [['warning', warning], ['ordinary', 'default']]) {
      await state.handlers.handleTabState(1, { status: 'loading' }, {
        url: `https://${host}.example`, incognito: true,
      })
      await new Promise(setImmediate)
      assert.equal(icon, expected)
    }
  }
})

function notificationFixture(showNotifications = true) {
  const storage = { notifiedHosts: ['previous.example'], showNotifications }
  const notifications = []
  const writes = []
  const icons = []
  const browser = {
    tabs: { TabStatus: { LOADING: 'loading' } },
    notifications: { create: async id => notifications.push(id) },
    storage: { local: {
      get: async defaults => structuredClone({ ...defaults, ...storage }),
      set: async values => {
        writes.push(structuredClone(values))
        Object.assign(storage, structuredClone(values))
      },
    } },
  }
  const { handleTabState } = load('background/handlers', {
    'browser-api': { default: browser },
    settings: { default: {
      extensionEnabled: async () => true,
      setDefaultIcon() {},
      setDangerIcon: id => icons.push(id),
      getName: () => 'Censor Tracker',
      getDangerIcon: () => 'icon.png',
    } },
    ignore: { default: { contains: async () => false } },
    registry: { default: {
      retrieveDisseminator: async url => ({ url, cooperationRefused: false }),
      contains: async () => false,
    } },
    i18n: { initializeLanguage: async () => {}, getMessage: () => 'Warning' },
    utilities: { extractDomainFromUrl: url => new URL(url).hostname },
    proxy: {}, server: {}, task: {}, 'proxy-route': {},
    'proxy-importer': {}, 'proxy-recovery': {}, 'service-mirrors': {},
  })
  return { storage, notifications, writes, icons, visit: async incognito => {
    const tab = { url: 'https://host.example' }
    if (incognito !== undefined) tab.incognito = incognito
    await handleTabState(1, { status: 'loading' }, tab)
    // Drain the nested promise handlers before checking their effects.
    await new Promise(resolve => setImmediate(resolve))
  } }
}

for (const incognito of [true, undefined]) {
  test(`private or unknown tab (${incognito}) only changes the icon`, async () => {
    const state = notificationFixture()
    await state.visit(incognito)
    assert.deepEqual(state.icons, [1])
    assert.deepEqual(state.notifications, [])
    assert.deepEqual(state.writes, [])
    assert.deepEqual(state.storage.notifiedHosts, ['previous.example'])
  })
}

test('regular tabs notify and save each new host once', async () => {
  const state = notificationFixture()
  await state.visit(false)
  await state.visit(false)
  assert.deepEqual(state.icons, [1, 1])
  assert.deepEqual(state.notifications, ['host.example'])
  assert.equal(state.writes.length, 1)
  assert.deepEqual(state.storage.notifiedHosts, ['previous.example', 'host.example'])
})

test('disabled notifications do not save hosts', async () => {
  const state = notificationFixture(false)
  await state.visit(false)
  assert.deepEqual(state.icons, [1])
  assert.deepEqual(state.notifications, [])
  assert.deepEqual(state.writes, [])
  assert.deepEqual(state.storage.notifiedHosts, ['previous.example'])
})

test('startup schedules hourly tasks and replaces old persisted periods', async () => {
  const alarms = new Map(['ping', 'setProxy', 'removeBadProxies'].map(name => [name, { periodInMinutes: 10 }]))
  const created = []
  const task = load('background/task', { 'browser-api': { default: { alarms: {
    get: async name => alarms.get(name),
    create: (name, options) => { alarms.set(name, options); created.push(name) },
  } } } }).default
  const state = fixture({}, {}, { task: { default: task } })
  await state.handlers.handleStartup()
  await state.handlers.handleStartup()
  assert.deepEqual(created, ['ping', 'setProxy', 'removeBadProxies'])
  assert.ok([...alarms.values()].every(alarm => alarm.periodInMinutes === 60))
})
