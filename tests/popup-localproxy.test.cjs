const assert = require('node:assert/strict')
const { test } = require('node:test')
const ui = require('./render.cjs')

test('the open popup reloads only when local routing values change', async () => {
  let reloads = 0
  const state = ui.storageFixture()
  const { PopupPage } = ui.moduleFor('pages/popup', {
    'browser-api': { default: state.browser },
    state: { readPopup: async () => ({ consent: false }) },
    notices: { Notices: () => null }, 'consent-status': { ConsentStatus: () => null },
    'page-error': { PageError: () => null }, 'background-rpc': {},
    'data-consent': {}, proxy: {}, settings: {},
    'proxy-info': {}, 'related-domains': {}, 'key-sequence': { useKeySequence() {} },
    'private-browsing': { usePrivateBrowsing: () => ({ allowed: true }) },
  }, { window: { location: { reload: () => { reloads++ } } } })
  const view = ui.testing.render(ui.h(PopupPage))
  const changed = (change, area) => { for (const listener of state.listeners) listener(change, area) }
  for (const key of ['useLocalProxy', 'localProxyAlive', 'useProxy']) {
    for (const [oldValue, newValue] of [[false, true], [true, false]]) changed({ [key]: { oldValue, newValue } }, 'local')
    changed({ [key]: { oldValue: true, newValue: true } }, 'local')
    changed({ [key]: { oldValue: false, newValue: true } }, 'sync')
  }
  changed({ localProxyURI: { newValue: '127.0.0.1:23456' } }, 'local')
  changed({ enableExtension: { oldValue: false, newValue: true } }, 'local')
  assert.equal(reloads, 6)
  view.unmount()
  assert.equal(state.listeners.size, 0)
})
