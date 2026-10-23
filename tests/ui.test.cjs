const assert = require('node:assert/strict')
const { test, before, after, afterEach } = require('node:test')
const { JSDOM } = require('jsdom')
const { h } = require('preact')
const load = require('./load.cjs')
let dom, render, fireEvent, waitFor, cleanup
before(() => {
  dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'https://extension.test/' })
  for (const key of ['window', 'document', 'HTMLElement', 'Node', 'Element', 'MutationObserver']) {
    global[key] = dom.window[key]
  }
  ;({ render, fireEvent, waitFor, cleanup } = require('@testing-library/preact'))
})
afterEach(() => cleanup())
after(() => dom.window.close())
const page = (entry, mocks = {}) => load('../ui/' + entry, {
  i18n: { getMessage: key => key },
  'browser-api': { default: {} },
  ...mocks,
}, { window, document, HTMLElement, Node, Element, Error })

test('consent disables all actions during a request and permits retry after failure', async () => {
  let reject, calls = []
  const { ConsentPage } = page('pages/consent', {
    'background-rpc': { callBackground: (...args) => {
      calls.push(args)
      return new Promise((_, fail) => { reject = fail })
    } },
  })
  render(h(ConsentPage))
  fireEvent.click(document.getElementById('acceptConsent'))
  await waitFor(() => assert.ok([...document.querySelectorAll('button')].every(b => b.disabled)))
  fireEvent.click(document.getElementById('declineConsent'))
  assert.deepEqual(calls, [['setDataConsent', true]])
  reject(new Error('Offline'))
  await waitFor(() => assert.equal(document.getElementById('consentError').textContent, 'operationFailed'))
  assert.ok([...document.querySelectorAll('button')].every(b => !b.disabled))
  fireEvent.click(document.getElementById('declineConsent'))
  assert.deepEqual(calls[1], ['setDataConsent', false])
  reject(new Error('Offline'))
})

test('rich catalog messages retain markup and escape extension names', () => {
  const { RichMessage } = page('components/message', {
    i18n: { getMessage: (key, values) => `<b>${values[0]}</b><a href="https://example.com">Help</a>` },
  })
  const { container } = render(h(RichMessage, { message: 'conflict', substitutions: '<img src=x onerror=alert(1)>' }))
  assert.equal(container.querySelector('b').textContent, '<img src=x onerror=alert(1)>')
  assert.equal(container.querySelector('img'), null)
  assert.equal(container.querySelector('a').href, 'https://example.com/')
})

test('resource subscriptions ignore stale reads and are removed on unmount', async () => {
  const listeners = new Set(), pending = []
  const { useResource } = page('hooks/async', {
    'browser-api': { default: { storage: { onChanged: {
      addListener: fn => listeners.add(fn), removeListener: fn => listeners.delete(fn),
    } } } },
  })
  function Example() {
    const { value } = useResource(() => new Promise(resolve => pending.push(resolve)), ['data'])
    return h('output', null, value || '')
  }
  const result = render(h(Example))
  await waitFor(() => assert.equal(pending.length, 1))
  for (const listener of listeners) listener({ data: {} }, 'local')
  assert.equal(pending.length, 2)
  pending[1]('current')
  await waitFor(() => assert.equal(result.container.textContent, 'current'))
  pending[0]('stale')
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(result.container.textContent, 'current')
  result.unmount()
  await waitFor(() => assert.equal(listeners.size, 0))
})
