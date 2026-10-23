const assert = require('node:assert/strict')
const { test } = require('node:test')
const ui = require('./render.cjs')

test('a failed task displays one accessible error and removes its listener', async () => {
  const { PageError } = ui.moduleFor('components/page-error')
  const view = ui.testing.render(ui.h(PageError))
  const report = reason => {
    const event = new window.Event('unhandledrejection')
    event.reason = reason
    ui.testing.fireEvent(window, event)
  }
  report(new Error('First failure'))
  report(new Error('Second failure'))
  await ui.testing.waitFor(() => assert.match(ui.byId('pageError').textContent, /Second failure/))
  assert.equal(document.querySelectorAll('[role="alert"]').length, 1)
  view.unmount()
  report(new Error('After unmount'))
  assert.equal(document.querySelector('[role="alert"]'), null)
})
