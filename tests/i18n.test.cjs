const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const en = require('../src/locales/en/messages.json')
const ru = require('../src/locales/ru/messages.json')

function fixture(uiLanguage = 'auto') {
  let changed
  let reads = 0
  const storage = { uiLanguage }
  const browser = {
    i18n: { getUILanguage: () => 'en-US', getMessage: key => `native:${key}` },
    storage: {
      local: { get: async defaults => { reads++; return { ...defaults, ...storage } } },
      onChanged: { addListener: listener => { changed = listener } },
    },
  }
  const api = load('background/i18n', { 'browser-api': { default: browser } })
  return { ...api, browser, reads: () => reads,
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
    assert.equal(state.browser.i18n.getMessage, native)
  }
})

test('language changes update translations and country names without restarting the background', async () => {
  const state = fixture('en')
  await state.initializeLanguage()
  state.change('ru', 'sync')
  assert.equal(state.getMessage('uiLanguageTitle'), 'Language')
  state.change('ru')
  assert.equal(state.getMessage('uiLanguageTitle'), 'Язык')
  assert.equal(new Intl.DisplayNames([state.getUILanguage()], { type: 'region' }).of('SE'), 'Швеция')
  state.change('uk')
  assert.equal(state.getMessage('uiLanguageTitle'), 'Мова')
  state.change(undefined)
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

test('an old native message catalog falls back to the bundled browser language', async () => {
  for (const [locale, title, auto] of [['en-US', 'Language', 'Browser language'],
    ['ru-RU', 'Язык', 'Язык браузера'], ['uk-UA', 'Мова', 'Мова браузера'],
    ['de-DE', 'Language', 'Browser language']]) {
    const state = fixture()
    state.browser.i18n.getMessage = () => ''
    state.browser.i18n.getUILanguage = () => locale
    await state.initializeLanguage()
    assert.equal(state.getMessage('uiLanguageTitle'), title)
    assert.equal(state.getMessage('uiLanguageAuto'), auto)
  }
})

test('message formatting supports numbered, named, and literal dollar placeholders', async t => {
  en.testFormatting = { message: '$$ $1 $2 $HOST$', placeholders: { host: { content: '$2' } } }
  t.after(() => { delete en.testFormatting })
  const state = fixture('en')
  await state.initializeLanguage()
  assert.equal(state.getMessage('testFormatting', ['$2', 'host.example']), '$ $2 host.example host.example')
  assert.equal(state.getMessage('cooperationAcceptedMessage', 'host.example'), 'host.example may share your data with third parties.')
  assert.equal(state.getMessage('missing'), '')
})

test('missing translations fall back to English and invalid settings use the browser language', async t => {
  const saved = ru.uiLanguageTitle
  delete ru.uiLanguageTitle
  t.after(() => { ru.uiLanguageTitle = saved })
  const state = fixture('ru')
  await state.initializeLanguage()
  assert.equal(state.getMessage('uiLanguageTitle'), 'Language')
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
  }
  const handlers = load('background/handlers', {
    'browser-api': { default: browser },
    settings: { default: { getName: () => 'Censor Tracker', getDangerIcon: () => 'icon.png' } },
    utilities: { extractDomainFromUrl: () => 'host.example' },
    proxy: {}, ignore: {}, registry: {}, server: {}, task: {},
    'proxy-route': {}, 'proxy-importer': {}, 'proxy-recovery': {},
  })
  await handlers.showDisseminatorWarning('https://host.example')
  assert.match(notification.message, /host\.example/)
  assert.equal(notification.message, require('../src/locales/uk/messages.json')
    .cooperationAcceptedMessage.message.replace('$hostname$', 'host.example'))
})
