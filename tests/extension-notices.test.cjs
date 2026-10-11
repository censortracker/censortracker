const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const ui = require('./render.cjs')

function fixture() {
  const state = {}
  const listeners = []
  const tabs = []
  const focus = []
  let failWrite = false
  const browser = {
    storage: {
      local: {
        get: async keys => Object.fromEntries(keys.map(key => [key, state[key]])),
        set: async values => {
          if (failWrite) throw new Error('Storage failed')
          const changes = Object.fromEntries(Object.entries(values).map(([key, value]) =>
            [key, { oldValue: state[key], newValue: value }]))
          Object.assign(state, values)
          listeners.forEach(listener => listener(changes, 'local'))
        },
      },
      onChanged: { addListener: listener => listeners.push(listener), removeListener: listener => { const index = listeners.indexOf(listener); if (index >= 0) listeners.splice(index, 1) } },
    },
    runtime: { getURL: path => `extension://${path}` },
    tabs: {
      query: async () => tabs,
      create: async tab => tabs.push({ ...tab, id: 1, windowId: 2 }),
      update: async (id, options) => focus.push({ id, ...options }),
    },
    windows: { update: async (id, options) => focus.push({ id, ...options }) },
  }
  const mocks = { 'browser-api': { default: browser } }
  const api = load('background/extension-notices', mocks)
  return { state, browser, api, mocks, tabs, focus,
    fail: value => { failWrite = value } }
}

for (const reason of ['install', 'update']) {
  test(`${reason} activates notices once and keeps dismissal across updates`, async () => {
    const { api, state } = fixture()
    assert.equal(await api.activateNotices(reason), true)
    assert.equal((await api.pendingNotices())[0].id, 'release-21')
    assert.equal(await api.activateNotices(reason), false)
    await api.dismissNotice('release-21')
    assert.equal(await api.activateNotices('update'), false)
    assert.equal((await api.pendingNotices()).length, 0)
    assert.equal(state['noticeRead:release-21'], true)
  })
}

test('browser updates do not activate notices; catalog order sets the queue', async () => {
  const { api } = fixture()
  api.extensionNotices.push({ id: 'next', title: 'title', text: 'text', events: ['update'] })
  assert.equal(await api.activateNotices('browser_update'), false)
  await api.activateNotices('install')
  await api.activateNotices('update')
  assert.equal((await api.pendingNotices()).map(n => n.id).join(), 'release-21,next')
  await Promise.all([api.dismissNotice('next'), api.dismissNotice('release-21')])
  assert.equal((await api.pendingNotices()).length, 0)
})

test('opening notices reuses and focuses their existing tab', async () => {
  const { api, tabs, focus } = fixture()
  await api.openNotices()
  await api.openNotices()
  assert.equal(tabs.length, 1)
  assert.equal(focus[0].active, true)
  assert.equal(focus[1].focused, true)
})

async function view(f, closeWhenEmpty = false) {
  let closed = 0
  const { Notices } = ui.moduleFor('components/notices', {
    ...f.mocks, 'extension-notices': f.api,
  })
  const result = ui.testing.render(ui.h(Notices, {
    onEmpty: closeWhenEmpty ? async () => { closed++ } : undefined,
  }))
  await require('preact/test-utils').act(() => {})
  return { ...result, section: result.container.querySelector('section'), closed: () => closed }
}

test('dismissal advances all views, persists, and closes only the dedicated page', async () => {
  const f = fixture()
  f.api.extensionNotices.push({ id: 'next', title: 'nextTitle', text: 'nextText', events: ['install'] })
  await f.api.activateNotices('install')
  const popup = await view(f), consent = await view(f), page = await view(f, true)
  const button = popup.section.querySelector('button')
  await ui.testing.waitFor(() => assert.equal(popup.section.querySelector('h2').textContent, 'release21Title'))
  ui.testing.fireEvent.click(button)
  await ui.testing.waitFor(() => assert.equal(popup.section.querySelector('h2').textContent, 'nextTitle'))
  assert.equal(consent.section.querySelector('h2').textContent, 'nextTitle')
  assert.equal(page.section.querySelector('h2').textContent, 'nextTitle')
  assert.equal(page.closed(), 0)
  await ui.testing.waitFor(() => assert.equal(button.disabled, false))
  ui.testing.fireEvent.click(button)
  await ui.testing.waitFor(() => assert.ok(page.closed() > 0))
  assert.equal(popup.section.hidden, true)
  assert.equal(consent.closed(), 0)
  const reopened = await view(f)
  assert.equal(reopened.section.hidden, true)
  assert.equal(f.state.dataConsent, undefined)
})

test('failed dismissal leaves the notice visible and permits retry', async () => {
  const f = fixture()
  await f.api.activateNotices('update')
  const popup = await view(f)
  const button = popup.section.querySelector('button')
  await ui.testing.waitFor(() => assert.equal(popup.section.hidden, false))
  f.fail(true)
  ui.testing.fireEvent.click(button)
  await ui.testing.waitFor(() => assert.equal(popup.section.querySelector('[role="alert"]').textContent, 'operationFailed'))
  assert.equal(popup.section.hidden, false)
  assert.equal(button.disabled, false)
  f.fail(false)
  ui.testing.fireEvent.click(button)
  await ui.testing.waitFor(() => assert.equal(popup.section.hidden, true))
})

for (const accepted of [undefined, true, false]) {
  test(`after notices, show consent only without a saved choice: ${accepted}`, async () => {
    const state = {}, navigations = []
    let closed = false
    const { NotificationsPage } = ui.moduleFor('pages/notifications', {
      'browser-api': { default: { storage: { local: { set: async values => Object.assign(state, values) } } } },
      'data-consent': { CONSENT_VERSION: 1, getDataConsent: async () => accepted === undefined ? null : { version: 1, accepted } },
      'key-sequence': { useKeySequence() {} },
      navigation: { navigate: (path, replace) => { assert.equal(replace, true); navigations.push(path) } },
      notices: { Notices: ({ onEmpty }) => {
        require('preact/hooks').useEffect(() => { onEmpty() }, [])
        return null
      } },
    }, { window: { close: () => { closed = true }, location: { replace: path => navigations.push(path) },
      addEventListener: window.addEventListener.bind(window), removeEventListener: window.removeEventListener.bind(window) } })
    ui.testing.render(ui.h(NotificationsPage))
    await ui.testing.waitFor(() => assert.equal(navigations.length + Number(closed), 1))
    assert.deepEqual(navigations, accepted === undefined ? ['/consent.html'] : [])
    assert.equal(state.consentPromptVersion, accepted === undefined ? 1 : undefined)
    assert.equal(closed, accepted !== undefined)
  })
}
