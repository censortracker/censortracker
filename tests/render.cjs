const { before, after, afterEach } = require('node:test')
const { JSDOM } = require('jsdom')
const { h } = require('preact')
const load = require('./load.cjs')
const { storageFixture } = require('./storage-fixture.cjs')
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
module.exports = { h, moduleFor, storageFixture,
  get testing() { return { ...testing, render: (node, options) => testing.render(node, { wrapper: errors?.PageErrors, ...options }) } },
  byId: id => document.getElementById(id),
}
