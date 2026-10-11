const { before, after, afterEach } = require('node:test')
const { JSDOM } = require('jsdom')
const { h } = require('preact')
const load = require('./load.cjs')
let dom, testing, errors
before(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://extension.test/' })
  for (const key of ['window', 'document', 'HTMLElement', 'Node', 'Element', 'MutationObserver']) global[key] = dom.window[key]
  testing = require('@testing-library/preact')
})
afterEach(async () => {
  testing.cleanup()
  await require('preact/test-utils').act(() => {})
})
after(() => dom.window.close())
function moduleFor(entry, mocks = {}, globals = {}) {
  errors ||= load('../ui/hooks/errors')
  return load('../ui/' + entry, {
    errors,
    i18n: { getMessage: (key, values) => key + (values === undefined ? '' : ':' + [].concat(values).join('|')),
      getUILanguage: () => 'en', initializeLanguage: async () => 'en' },
    ...mocks,
  }, { window, document, HTMLElement, Node, Element, Error, Blob, ...globals })
}
function storageFixture(initial = {}) {
  const data = { ...initial }, listeners = new Set()
  const browser = { isFirefox: false, runtime: { getURL: path => 'chrome-extension://test/' + path, getManifest: () => ({ version: '21.0.0' }) },
    storage: { local: {
      get: async keys => typeof keys === 'string' ? { [keys]: data[keys] }
        : Array.isArray(keys) ? Object.fromEntries(keys.map(key => [key, data[key]])) : { ...keys, ...data },
      set: async values => { const changes = Object.fromEntries(Object.entries(values).map(([key, value]) =>
        [key, { oldValue: data[key], newValue: value }]))
        Object.assign(data, values); for (const listener of listeners) listener(changes, 'local') },
    }, onChanged: { addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn) } },
  }
  return { browser, data, listeners }
}
module.exports = { h, moduleFor, storageFixture,
  get testing() { return { ...testing, render: (node, options) => testing.render(node, { wrapper: errors?.PageErrors, ...options }) } },
  byId: id => document.getElementById(id),
}
