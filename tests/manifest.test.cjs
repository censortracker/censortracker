const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')
const { extensionManifest, browserTargets } = require('./load.cjs')('../../manifest')

test('WXT preserves API permissions, consent metadata and browser versions', () => {
  for (const [browser, modern, name] of [['chrome', false, 'chrome'], ['firefox', false, 'firefox'], ['firefox', true, 'firefox-modern']]) {
    const expected = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures/manifests', name + '.json')))
    for (const field of ['author', 'background', 'options_ui', 'version', 'manifest_version']) delete expected[field]
    if (browser === 'chrome') delete expected.action.default_name
    delete expected[browser === 'firefox' ? 'browser_action' : 'action'].default_popup
    if (browser === 'firefox') expected.content_security_policy = { extension_pages: expected.content_security_policy }
    assert.deepEqual(JSON.parse(JSON.stringify(extensionManifest(browser, modern))), expected)
  }
  assert.deepEqual(Array.from(browserTargets), ['chrome108', 'firefox91'])
})

test('WXT uses Preact, shared CSS modules, and the minimum browser targets', async () => {
  const { loadConfig } = await import('c12')
  const { config } = await loadConfig({ name: 'wxt', cwd: path.resolve(__dirname, '..') })
  const vite = config.vite({ mode: 'production' })
  assert.equal(config.srcDir, 'src')
  assert.equal(config.imports, false)
  assert.deepEqual(vite.build.target, Array.from(browserTargets))
  assert.equal(vite.build.minify, 'terser')
  assert.equal(vite.build.terserOptions.compress.inline, false)
  assert.ok(vite.plugins.flat().some(plugin => plugin.name.startsWith('preact:')))
})
