const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const ui = require('./render.cjs')

test('old profiles derive registry status from their cache', async () => {
  for (const domains of [[], ['cached.example']]) {
    const registry = load('background/registry', { 'browser-api': { default: { storage: { local: {
      get: async defaults => ({ ...defaults, domains }),
    } } } } }).default
    const status = await registry.getStatus()
    assert.equal(status.state, domains.length ? 'ready' : 'not_loaded')
    assert.equal(status.skipped, 0)
    assert.equal(status.error, '')
  }
})

test('registry UI separates source failure from an empty list and updates skipped counts', async () => {
  let status = { state: 'empty', skipped: 0, error: '' }
  const state = ui.storageFixture()
  const { RegistryStatus } = ui.moduleFor('components/registry-status', {
    'browser-api': { default: state.browser },
    'background-rpc': { callBackground: async action => action === 'registryStatus' ? status : status.state !== 'ready' },
  })
  ui.testing.render(ui.h(RegistryStatus, { warning: true }))
  const warning = ui.byId('optionsRegistryIsEmptyWarning')
  const summary = ui.byId('builtinRegistryStatus')
  await ui.testing.waitFor(() => assert.match(warning.textContent, /registryStatus_empty/))
  const change = next => {
    status = next
    for (const listener of state.listeners) listener({ registryStatus: {} }, 'local')
  }
  change({ state: 'unavailable', skipped: 0, error: 'Registry: HTTP 503' })
  await ui.testing.waitFor(() => assert.match(warning.textContent, /Registry: HTTP 503/))
  assert.equal(warning.hidden, false)
  change({ state: 'ready', skipped: 1, error: '' })
  await ui.testing.waitFor(() => assert.match(summary.textContent, /registrySkipped:1/))
  assert.equal(warning.hidden, true)
  assert.equal(summary.hidden, true)
  change({ state: 'unavailable', skipped: 0, error: 'Registry: HTTP 503' })
  await ui.testing.waitFor(() => assert.equal(summary.hidden, false))
})
