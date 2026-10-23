const assert = require('node:assert/strict')
const { test } = require('node:test')
const { execFile } = require('node:child_process')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const { promisify } = require('node:util')

// Exercise web-ext's HTML decoder and its own ESLint version after upgrades.
test('release tools read UTF-8 pages and still detect unsafe scripts', async () => {
  const source = await fs.mkdtemp(path.join(os.tmpdir(), 'ct-toolchain-'))
  const cli = path.join(path.dirname(require.resolve('web-ext')), 'bin/web-ext.js')
  const lint = () => promisify(execFile)(process.execPath, [cli, 'lint',
    '--source-dir', source, '--output=json', '--warnings-as-errors'], { timeout: 15000 })
  try {
    await fs.writeFile(path.join(source, 'manifest.json'), JSON.stringify({
      manifest_version: 3, name: 'Toolchain test', version: '1.0',
      browser_specific_settings: { gecko: { id: 'toolchain@censortracker.test',
        strict_min_version: '142.0', data_collection_permissions: { required: ['none'] } } },
      options_ui: { page: 'options.html' },
    }))
    await fs.writeFile(path.join(source, 'options.html'),
      '<!doctype html><html lang="ru"><meta charset="utf-8"><title>Пример</title><p id="message"></p><script src="options.js"></script></html>')
    await fs.writeFile(path.join(source, 'options.js'),
      'document.getElementById("message").textContent = "Привет"')
    const { stdout } = await lint()
    assert.deepEqual(JSON.parse(stdout).summary, { errors: 0, notices: 0, warnings: 0 })
    await fs.writeFile(path.join(source, 'options.js'), 'eval("1 + 1")')
    await assert.rejects(lint(), error => {
      const report = JSON.parse(error.stdout)
      assert.ok([...report.errors, ...report.warnings].some(item => /eval/i.test(item.code)))
      return true
    })
  } finally {
    await fs.rm(source, { recursive: true, force: true })
  }
})
