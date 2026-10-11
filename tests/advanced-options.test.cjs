const assert = require('node:assert/strict')
const { test } = require('node:test')
const ui = require('./render.cjs')
const sequence = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

async function fixture({ saved = false, apply = async () => {}, operations = {} } = {}) {
  const state = ui.storageFixture({ proxyAll: saved })
  const calls = []
  let info = { generatedAt: 'first' }, failure
  const { AdvancedOptionsPage } = ui.moduleFor('pages/advanced-options', {
    'browser-api': { default: state.browser },
    'background-rpc': { callBackground: async (action, value) => {
      calls.push([action, value])
      if (action === 'diagnosticInfo') {
        if (failure) throw failure
        return info
      }
      assert.equal(action, 'setProxyAll')
      await apply(value)
      state.data.proxyAll = value
    } },
    'site-rules': { SiteRules: () => null },
    'registry-status': { RegistryStatus: () => null },
    'consent-status': { ConsentStatus: () => null },
    'settings-operations': { exportFile: async () => {}, importSettings: async () => {}, resetSettings: async () => {}, updateRegistry: async () => {}, ...operations },
  })
  const view = ui.testing.render(ui.h(AdvancedOptionsPage))
  await ui.testing.waitFor(() => assert.equal(ui.byId('proxyAll').checked, saved))
  const click = id => ui.testing.fireEvent.click(ui.byId(id))
  const enter = async (keys = sequence, target = document.body, options = {}) => {
    for (const key of keys) ui.testing.fireEvent.keyDown(target, { key, ...options })
    await require('preact/test-utils').act(() => {})
  }
  return { ...state, ...view, calls, click, enter,
    update: value => { info = value }, fail: error => { failure = error } }
}

test('debug information refreshes the textarea and restores its button after errors', async () => {
  const state = await fixture()
  state.click('showDebugInfo')
  await ui.testing.waitFor(() => assert.equal(JSON.parse(ui.byId('debugInfoJSON').value).generatedAt, 'first'))
  state.update({ generatedAt: 'second' })
  state.click('showDebugInfo')
  await ui.testing.waitFor(() => assert.equal(JSON.parse(ui.byId('debugInfoJSON').value).generatedAt, 'second'))
  assert.equal(ui.byId('copyDebugInfoBtn').textContent, 'copyButton')
  state.fail(new Error('Background unavailable'))
  state.click('showDebugInfo')
  await ui.testing.waitFor(() => assert.match(ui.byId('pageError').textContent, /Background unavailable/))
  assert.equal(ui.byId('showDebugInfo').disabled, false)
})

test('exports download the correct documents and release each download URL', async () => {
  const downloads = [], revoked = [], blobs = new Map()
  const click = window.HTMLAnchorElement.prototype.click
  window.HTMLAnchorElement.prototype.click = function () { downloads.push({ filename: this.download, blob: blobs.get(this.href) }) }
  try {
    const { exportFile } = ui.moduleFor('pages/settings-operations', {
      'background-rpc': { callBackground: async () => ({ reportType: 'censortracker-diagnostics' }) },
      settings: { default: { exportSettings: async () => ({ formatVersion: 1, settings: { useProxy: true } }) } },
      proxy: {}, server: {}, 'browser-api': {},
    }, { URL: { createObjectURL: blob => { const url = 'blob:test-' + blobs.size; blobs.set(url, blob); return url }, revokeObjectURL: url => revoked.push(url) } })
    await exportFile(false)
    await exportFile(true)
    assert.deepEqual(downloads.map(({ filename }) => filename), ['censortracker.settings.json', 'censortracker.diagnostics.json'])
    assert.equal(JSON.parse(await downloads[0].blob.text()).formatVersion, 1)
    assert.equal(JSON.parse(await downloads[1].blob.text()).reportType, 'censortracker-diagnostics')
    assert.equal(revoked.length, 2)
    assert.equal(document.querySelector('a[download]'), null)
  } finally { window.HTMLAnchorElement.prototype.click = click }
})

test('only the complete sequence reveals extended settings without changing preferences', async () => {
  const state = await fixture({ saved: true })
  await state.enter(sequence.slice(0, -1))
  assert.equal(ui.byId('extendedSettings').hidden, true)
  await state.enter(['x', 'a'])
  assert.equal(ui.byId('extendedSettings').hidden, true)
  await state.enter(sequence.map(key => key.length === 1 ? key.toUpperCase() : key))
  assert.equal(ui.byId('extendedSettings').hidden, false)
  await state.enter()
  assert.equal(ui.byId('extendedSettings').hidden, false)
  assert.deepEqual(state.calls, [])
})

test('the other-page sequence opens the bundled animation in a tab and cleans up', async () => {
  const tabs = []
  const { useKeySequence } = ui.moduleFor('hooks/key-sequence', { 'browser-api': { default: {
    runtime: { getURL: page => 'chrome-extension://test/' + page }, tabs: { create: options => tabs.push(options) },
  } } })
  function Example() { useKeySequence(); return null }
  const view = ui.testing.render(ui.h(Example))
  for (const key of sequence) ui.testing.fireEvent.keyDown(document.body, { key })
  assert.equal(tabs.length, 1)
  assert.equal(tabs[0].url, 'chrome-extension://test/animation.html')
  view.unmount()
  await require('preact/test-utils').act(() => {})
  for (const key of sequence) ui.testing.fireEvent.keyDown(document.body, { key })
  assert.equal(tabs.length, 1)
})

test('held keys are ignored and text input clears sequence progress', async () => {
  const state = await fixture()
  await state.enter([sequence[0]])
  await state.enter([sequence[0]], document.body, { repeat: true })
  await state.enter(sequence.slice(1))
  assert.equal(ui.byId('extendedSettings').hidden, false)
  state.unmount()
  await require('preact/test-utils').act(() => {})
  for (const tag of ['input', 'textarea', 'select', 'div']) {
    const next = await fixture()
    const target = document.createElement(tag)
    if (tag === 'div') Object.defineProperty(target, 'isContentEditable', { value: true })
    document.body.append(target)
    await next.enter(sequence.slice(0, 2))
    await next.enter(['ArrowDown'], target)
    await next.enter(sequence.slice(2))
    await next.enter(sequence, target)
    assert.equal(ui.byId('extendedSettings').hidden, true)
    await next.enter()
    assert.equal(ui.byId('extendedSettings').hidden, false)
    next.unmount(); target.remove()
    await require('preact/test-utils').act(() => {})
  }
})

for (const failed of [false, true]) test(`proxy-all restores saved state and button after ${failed ? 'failure' : 'success'}`, async () => {
  let finish
  const state = await fixture({ apply: async () => {
    await new Promise(resolve => { finish = resolve })
    if (failed) throw new Error('Routing failed')
  } })
  state.click('proxyAll')
  await ui.testing.waitFor(() => assert.equal(ui.byId('proxyAll').disabled, true))
  finish()
  await ui.testing.waitFor(() => assert.equal(ui.byId('proxyAll').disabled, false))
  assert.deepEqual(state.calls, [['setProxyAll', true]])
  assert.equal(ui.byId('proxyAll').checked, !failed)
  if (failed) assert.match(ui.byId('pageError').textContent, /Routing failed/)
})

for (const failed of [false, true]) test(`reset dialog reports ${failed ? 'failure' : 'success'} and releases controls`, async () => {
  let finish
  const state = await fixture({ operations: { resetSettings: async () => {
    await new Promise(resolve => { finish = resolve })
    if (failed) throw new Error('Reset failed')
  } } })
  state.click('resetSettingsToDefault')
  assert.ok(ui.byId('popupConfirmReset').classList.contains('popup-show'))
  state.click('confirmReset')
  await ui.testing.waitFor(() => assert.equal(ui.byId('confirmReset').disabled, true))
  finish()
  await ui.testing.waitFor(() => assert.equal(ui.byId('confirmReset').disabled, false))
  assert.equal(ui.byId('popupConfirmReset').classList.contains('popup-show'), false)
  assert.equal(ui.byId('popupCompletedSuccessfully').classList.contains('popup-show'), !failed)
  if (failed) assert.match(ui.byId('pageError').textContent, /Reset failed/)
  else {
    await state.enter(['Escape'])
    assert.equal(ui.byId('popupCompletedSuccessfully').classList.contains('popup-show'), false)
  }
})
