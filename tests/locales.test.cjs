const assert = require('node:assert/strict')
const { test } = require('node:test')
const fs = require('node:fs')
const path = require('node:path')

test('all supported locales contain the same nonempty messages', () => {
  const read = locale => JSON.parse(fs.readFileSync(path.join(__dirname, '../src/locales', locale, 'messages.json')))
  const keys = Object.keys(read('en')).sort()
  for (const locale of ['ru', 'uk']) {
    const messages = read(locale)
    assert.deepEqual(Object.keys(messages).sort(), keys, locale)
    for (const [key, entry] of Object.entries(messages)) {
      assert.ok(entry.message, `${locale}: ${key}`)
      assert.match(key, /^[A-Za-z0-9_@]+$/, `${locale}: invalid message name ${key}`)
    }
  }
})
