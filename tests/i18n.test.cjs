const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const en = require('../src/locales/en/messages.json')
const ru = require('../src/locales/ru/messages.json')
const uk = require('../src/locales/uk/messages.json')
const catalogs = { en, ru, uk }
const settle = () => new Promise(resolve => setTimeout(resolve))

// Serves the packaged _locales files like the extension origin does.
function fetchLocales(fetched = []) {
  return async url => {
    fetched.push(url)
    const [, language] = url.match(/^ext:_locales\/(\w+)\/messages\.json$/)
    return { json: async () => catalogs[language] }
  }
}

function fixture(uiLanguage = 'auto', fetch) {
  let changed
  let reads = 0
  const fetched = []
  const storage = { uiLanguage }
  const browser = {
    i18n: { getUILanguage: () => 'en-US', getMessage: key => `native:${key}` },
    runtime: { getURL: path => 'ext:' + path },
    storage: {
      local: { get: async defaults => { reads++; return { ...defaults, ...storage } } },
      onChanged: { addListener: listener => { changed = listener } },
    },
  }
  const api = load('background/i18n', { 'browser-api': { default: browser } },
    { fetch: fetch || fetchLocales(fetched) })
  return { ...api, browser, fetched, reads: () => reads,
    change: (value, area = 'local') => changed({ uiLanguage: { newValue: value } }, area) }
}

test('all language choices load once and preserve native browser APIs', async () => {
  for (const [language, title] of [['auto', 'native:uiLanguageTitle'], ['en', 'Language'], ['ru', 'Язык'], ['uk', 'Мова']]) {
    const state = fixture(language)
    const native = state.browser.i18n.getMessage
    await Promise.all([state.initializeLanguage(), state.initializeLanguage()])
    assert.equal(state.getMessage('uiLanguageTitle'), title)
    assert.equal(state.getUILanguage(), language === 'auto' ? 'en-US' : language)
    assert.equal(state.reads(), 1)
    assert.deepEqual(state.fetched, language === 'auto' ? [] : [`ext:_locales/${language}/messages.json`])
    assert.equal(state.browser.i18n.getMessage, native)
  }
})

test('language changes update translations and country names without restarting the background', async () => {
  const state = fixture('en')
  await state.initializeLanguage()
  state.change('ru', 'sync')
  await settle()
  assert.equal(state.getMessage('uiLanguageTitle'), 'Language')
  state.change('ru')
  await settle()
  assert.equal(state.getMessage('uiLanguageTitle'), 'Язык')
  assert.equal(new Intl.DisplayNames([state.getUILanguage()], { type: 'region' }).of('SE'), 'Швеция')
  state.change('uk')
  await settle()
  assert.equal(state.getMessage('uiLanguageTitle'), 'Мова')
  state.change(undefined)
  await settle()
  assert.equal(state.getMessage('uiLanguageTitle'), 'native:uiLanguageTitle')
})

test('a language change during startup wins over an old storage read', async () => {
  const state = fixture()
  let release
  state.browser.storage.local.get = () => new Promise(resolve => { release = resolve })
  const pending = state.initializeLanguage()
  state.change('uk')
  release({ uiLanguage: 'ru' })
  assert.equal(await pending, 'uk')
  assert.equal(state.getMessage('uiLanguageTitle'), 'Мова')
})

test('unreadable or invalid catalogs keep the native browser language', async () => {
  for (const json of [async () => { throw new Error('missing') }, async () => ({ key: { message: 1 } })]) {
    const state = fixture('ru', async () => ({ json }))
    assert.equal(await state.initializeLanguage(), 'auto')
    assert.equal(state.getMessage('uiLanguageTitle'), 'native:uiLanguageTitle')
    assert.equal(state.getUILanguage(), 'en-US')
  }
})

test('message formatting supports numbered, named, and literal dollar placeholders', async t => {
  en.testFormatting = { message: '$$ $1 $2 $HOST$', placeholders: { host: { content: '$2' } } }
  t.after(() => { delete en.testFormatting })
  const state = fixture('en')
  await state.initializeLanguage()
  assert.equal(state.getMessage('testFormatting', ['$2', 'host.example']), '$ $2 host.example host.example')
  assert.equal(state.getMessage('cooperationAcceptedMessage', 'host.example'), 'host.example may share your data with third parties.')
  assert.equal(state.getMessage('missing'), 'native:missing')
})

test('missing translations fall back to the native catalog and invalid settings use the browser language', async t => {
  const saved = ru.uiLanguageTitle
  delete ru.uiLanguageTitle
  t.after(() => { ru.uiLanguageTitle = saved })
  const state = fixture('ru')
  await state.initializeLanguage()
  assert.equal(state.getMessage('uiLanguageTitle'), 'native:uiLanguageTitle')
  assert.equal(state.getMessage('uiLanguageAuto'), 'Язык браузера')
  const invalid = fixture('fr')
  await invalid.initializeLanguage()
  assert.equal(invalid.getUILanguage(), 'en-US')
})

test('notifications load the saved language before they generate text', async () => {
  let notification
  const storage = { uiLanguage: 'uk', notifiedHosts: [] }
  const browser = {
    storage: { local: {
      get: async defaults => ({ ...defaults, ...storage }),
      set: async values => Object.assign(storage, values),
    }, onChanged: { addListener() {} } },
    notifications: { create: async (id, value) => { notification = value } },
    runtime: { getURL: path => 'ext:' + path },
  }
  const handlers = load('background/handlers', {
    'browser-api': { default: browser },
    settings: { default: { getName: () => 'Censor Tracker', getDangerIcon: () => 'icon.png' } },
    utilities: { extractDomainFromUrl: () => 'host.example' },
    proxy: {}, ignore: {}, registry: {}, server: {}, task: {},
    'proxy-route': {}, 'proxy-importer': {}, 'proxy-recovery': {},
  }, { fetch: fetchLocales() })
  await handlers.showDisseminatorWarning('https://host.example')
  assert.match(notification.message, /host\.example/)
  assert.equal(notification.message, uk.cooperationAcceptedMessage.message.replace('$hostname$', 'host.example'))
})
