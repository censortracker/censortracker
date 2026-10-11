const assert = require('node:assert/strict')
const { test } = require('node:test')
const ui = require('./render.cjs')
const { h, moduleFor, storageFixture } = ui

const pending = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

test('a resource can discard a response before its debounced refresh starts', async () => {
  const state = storageFixture()
  const { useResource } = moduleFor('hooks/async', { 'browser-api': { default: state.browser } })
  const first = pending(), second = pending()
  let resource, calls = 0
  function Example() {
    resource = useResource(() => (++calls === 1 ? first.promise : second.promise))
    return h('output', null, resource.value || '')
  }
  const rendered = ui.testing.render(h(Example))
  resource.invalidate()
  first.resolve('stale')
  await ui.testing.act(async () => { await first.promise })
  assert.equal(rendered.container.textContent, '')
  const refresh = resource.refresh()
  second.resolve('current')
  await ui.testing.act(async () => { await refresh })
  assert.equal(rendered.container.textContent, 'current')
})

test('visible polling waits after completion, avoids overlap, and stops on unmount', async () => {
  const timers = new Map(), listeners = new Set()
  let next = 0, calls = 0
  const request = pending()
  const doc = { visibilityState: 'visible', addEventListener: (_, fn) => listeners.add(fn), removeEventListener: (_, fn) => listeners.delete(fn) }
  const { useVisiblePolling } = moduleFor('hooks/async', { 'browser-api': { default: {} } }, {
    document: doc,
    window: { setTimeout: (fn, ms) => { assert.equal(ms, 3000); timers.set(++next, fn); return next } },
    clearTimeout: id => timers.delete(id),
  })
  function Example() { useVisiblePolling(() => { calls++; return request.promise }, 3000); return null }
  const rendered = ui.testing.render(h(Example))
  assert.equal(timers.size, 1)
  const callback = [...timers.values()][0]
  timers.clear()
  const running = callback()
  assert.equal(calls, 1)
  for (const listener of listeners) listener()
  assert.equal(timers.size, 0)
  request.resolve()
  await running
  assert.equal(timers.size, 1)
  doc.visibilityState = 'hidden'
  for (const listener of listeners) listener()
  assert.equal(timers.size, 0)
  doc.visibilityState = 'visible'
  for (const listener of listeners) listener()
  assert.equal(timers.size, 1)
  rendered.unmount()
  assert.equal(timers.size, 0)
  assert.equal(listeners.size, 0)
})

test('domain import cancels a download on close and ignores a late response', async () => {
  const state = storageFixture({ customProxiedDomains: ['saved.example'] })
  const request = pending()
  let signal, closed = 0, updates = 0
  const { DomainImport } = moduleFor('components/domain-import', {
    'browser-api': { default: state.browser },
    request: { requestText: (_, options) => { signal = options.signal; return request.promise } },
    utilities: { isValidURL: () => true, removeDuplicates: domains => domains },
  }, { AbortController })
  ui.testing.render(h(DomainImport, { open: true, onClose: () => closed++, editor: { current: { setValue: () => updates++, focusEnd() {} } } }))
  ui.testing.fireEvent.input(document.getElementById('sourceURL'), { target: { value: 'https://source.example/list' } })
  ui.testing.fireEvent.click(document.getElementById('loadFromURLButton'))
  ui.testing.fireEvent.click(document.getElementById('closePopup'))
  assert.equal(signal.aborted, true)
  request.resolve('late.example')
  await ui.testing.act(async () => { await request.promise })
  assert.equal(updates, 0)
  assert.equal(closed, 1)
})

test('domain imports keep unsaved edits and previous imports', async () => {
  let draft = 'draft.example', closed = 0
  const { DomainImport } = moduleFor('components/domain-import', {
    request: { requestText: async () => `import${closed}.example\ndraft.example` },
  })
  ui.testing.render(h(DomainImport, { open: true, onClose: () => closed++,
    editor: { current: { getValue: () => draft, setValue: value => { draft = value }, focusEnd() {} } },
  }))
  ui.testing.fireEvent.input(ui.byId('sourceURL'), { target: { value: 'https://source.example/list' } })
  for (let index = 0; index < 2; index++) {
    ui.testing.fireEvent.click(ui.byId('loadFromURLButton'))
    await ui.testing.waitFor(() => assert.equal(closed, index + 1))
  }
  assert.equal(draft, 'draft.example\nimport0.example\nimport1.example\n')
})

test('proxy form keeps multiple draft changes and restores a repeated edit', async () => {
  const { ProxyForm } = moduleFor('pages/proxy/form', {
    'browser-api': { default: { isFirefox: false } },
    import: { ProtocolOptions: () => h('option', null, 'HTTP') },
  })
  let action
  const proxy = { id: 'one', name: 'Original', host: 'proxy.example', port: 8080, protocol: 'HTTP' }
  const props = { editing: proxy, revision: 0, busy: false, save: value => { action = value }, cancel() {}, invalid() { assert.fail('Invalid draft') } }
  const view = ui.testing.render(h(ProxyForm, props))
  ui.testing.fireEvent.input(document.getElementById('proxyName'), { target: { value: 'New name' } })
  ui.testing.fireEvent.input(document.getElementById('proxyUsername'), { target: { value: 'alice' } })
  ui.testing.fireEvent.submit(document.getElementById('proxyForm'))
  assert.equal(action.proxy.name, 'New name')
  assert.equal(action.proxy.username, 'alice')
  view.rerender(h(ProxyForm, { ...props, editing: { ...proxy } }))
  assert.equal(document.getElementById('proxyName').value, 'Original')
  assert.equal(document.activeElement.id, 'proxyServerInput')
})
