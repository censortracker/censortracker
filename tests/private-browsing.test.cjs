const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const ui = require('./render.cjs')

async function fixture(options = {}) {
  let allowed = options.allowed ?? true
  let badge
  let applied = 0
  let completed = 0
  const storage = { enableExtension: true, useProxy: false, privateBrowsingPermissionsRequired: false, ...options.storage }
  const events = {}
  const nodes = []
  const browser = { isFirefox: options.firefox ?? true, extension: { isAllowedIncognitoAccess: async () => allowed },
    browserAction: { setBadgeText: async ({ text }) => { badge = text } },
    i18n: { getMessage: key => key },
    storage: {
      local: {
        get: async keys => typeof keys === 'string' ? { [keys]: storage[keys] } : { ...keys, ...storage },
        set: async values => Object.assign(storage, values), remove: async key => { delete storage[key] },
      }, onChanged: { addListener() {}, removeListener() {} },
    },
  }
  const manager = load('background/proxy', { 'browser-api': { default: browser } }).default
  manager.setProxy = async () => { applied++; return options.apply ? options.apply() : options.success !== false }
  const { PrivateBrowsing } = ui.moduleFor('components/private-browsing', {
    'browser-api': { default: browser }, proxy: { default: manager },
    settings: { default: { extensionEnabled: async () => storage.enableExtension } },
  })
  ui.testing.render(ui.h(PrivateBrowsing, { onSuccess: () => { completed++ } }))
  const warning = ui.byId('privateBrowsingPermissionsRequiredMessage')
  const button = ui.byId('grantPrivateBrowsingPermissionsButton')
  const settle = () => new Promise(resolve => setTimeout(resolve, 20))
  await settle()
  return { browser, manager, storage, warning, button,
    events: {
      click: async () => { ui.testing.fireEvent.click(button); await settle() },
      focus: async () => { ui.testing.fireEvent(window, new window.Event('focus')); await settle() },
      visibilitychange: async () => { Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' }); ui.testing.fireEvent(document, new window.Event('visibilitychange')); await settle() },
    },
    get status() { return document.querySelector('p[role]') },
    buttonVisible: () => !button.hidden,
    allow: value => { allowed = value }, badge: () => badge, applied: () => applied, completed: () => completed }

}

test('a stale permission warning is cleared without enabling disabled proxy use', async () => {
  const state = await fixture({ storage: { privateBrowsingPermissionsRequired: true } })
  assert.equal(state.warning.hidden, true)
  assert.equal(state.storage.privateBrowsingPermissionsRequired, false)
  assert.equal(state.badge(), '')
  assert.equal(state.storage.useProxy, false)
  assert.equal(state.applied(), 0)
  assert.equal(state.buttonVisible(), false)
})

test('Chrome keeps the Firefox confirmation button hidden', async () => {
  const state = await fixture({ firefox: false })
  assert.equal(state.buttonVisible(), false)
})

test('focus detects permission grant and restores enabled proxy use', async () => {
  const state = await fixture({ allowed: false, storage: { useProxy: true } })
  assert.equal(state.warning.hidden, false)
  assert.equal(state.buttonVisible(), true)
  assert.equal(state.badge(), '✕')
  state.allow(true)
  await state.events.focus()
  assert.equal(state.warning.hidden, true)
  assert.equal(state.buttonVisible(), false)
  assert.equal(state.badge(), '')
  assert.equal(state.applied(), 1)
  await state.events.focus()
  assert.equal(state.applied(), 1)
})

test('permission grant clears the warning and badge even if proxy setup fails', async () => {
  const options = { allowed: false, success: false, storage: { useProxy: true, proxySetupError: 'PAC failed' } }
  const state = await fixture(options)
  state.allow(true)
  await state.events.focus()
  assert.equal(state.warning.hidden, true)
  assert.equal(state.badge(), '')
  assert.equal(state.storage.privateBrowsingPermissionsRequired, false)
  assert.equal(state.status.textContent, 'proxySetupFailed PAC failed')
  assert.equal(state.buttonVisible(), false)
  options.success = true
  await state.events.click()
  assert.equal(state.applied(), 2)
  assert.equal(state.status.textContent, 'proxySetupDone')
})

test('visibility detects permission removal', async () => {
  const state = await fixture()
  assert.equal(state.buttonVisible(), false)
  state.allow(false)
  await state.events.visibilitychange()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(state.warning.hidden, false)
  assert.equal(state.buttonVisible(), true)
  assert.equal(state.storage.privateBrowsingPermissionsRequired, true)
  assert.equal(state.badge(), '✕')
})

test('confirmation enables proxy use and reports completion', async () => {
  const state = await fixture()
  await state.events.click()
  assert.equal(state.storage.useProxy, true)
  assert.equal(state.applied(), 1)
  assert.equal(state.completed(), 1)
  assert.equal(state.status.textContent, 'proxySetupDone')
  assert.equal(state.status.getAttribute('role'), 'status')
  assert.equal(state.button.disabled, false)
  assert.equal(state.buttonVisible(), false)
})

for (const [options, expected] of [
  [{ allowed: false }, 'privateBrowsingStillRequired'],
  [{ storage: { enableExtension: false } }, 'proxySetupExtensionDisabled'],
  [{ success: false, storage: { proxySetupError: 'PAC failed' } }, 'proxySetupFailed PAC failed'],
]) {
  test(`confirmation reports ${expected}`, async () => {
    const state = await fixture(options)
    await state.events.click()
    assert.equal(state.status.textContent, expected)
    assert.equal(state.status.getAttribute('role'), 'alert')
    assert.equal(state.completed(), 0)
    assert.equal(state.button.disabled, false)
    assert.equal(state.applied(), options.success === false ? 1 : 0)
  })
}

test('pending confirmation reports progress and prevents repeated activation', async () => {
  let finish
  const state = await fixture({ apply: () => new Promise(resolve => { finish = resolve }) })
  const pending = state.events.click()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(state.status.textContent, 'proxySetupRunning')
  assert.equal(state.button.disabled, true)
  await state.events.click()
  assert.equal(state.applied(), 1)
  finish(true)
  await pending
  await ui.testing.waitFor(() => assert.equal(state.status.textContent, 'proxySetupDone'))
})

test('service proxy selection uses current country checks without loading the registry', async () => {
  const state = await fixture({ storage: { siteCountryRules: { 'example.com': ['RU'] } } })
  state.manager.getSelectedProxies = async () => [
    { id: 'ru', protocol: 'HTTPS', host: 'ru.example', port: 443, exitCountry: 'RU', countryExpiresAt: Date.now() + 10000 },
    { id: 'de', protocol: 'HTTPS', host: 'de.example', port: 443, exitCountry: 'DE', countryExpiresAt: Date.now() + 10000 },
  ]
  const route = await state.manager.getServiceProxyRoute('api.example.com')
  assert.deepEqual(Array.from(route.proxies), ['de'])
  state.storage.ignoredHosts = ['example.com']
  assert.equal((await state.manager.getServiceProxyRoute('api.example.com')).type, 'direct')
})
