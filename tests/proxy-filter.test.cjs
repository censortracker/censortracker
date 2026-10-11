const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const { filterProxies, checkedCountry } = load('../ui/pages/proxy/filter')

const proxies = [{ id: 'builtin', name: 'Censor Tracker' }, { id: 'b', name: 'Bravo' }, { id: 'a', name: 'Alpha' }]
const checks = { b: { status: 'ok', latency: 50, serverCountry: 'DE', exitCountry: 'US' },
  a: { status: 'ok', latency: 20, serverCountry: 'US', exitCountry: 'DE' } }
const ids = (options) => Array.from(filterProxies(proxies, checks, options), proxy => proxy.id)

test('proxy filters keep server and exit countries separate, with explicit unknown values', () => {
  assert.deepEqual(ids({ serverCountry: 'DE' }), ['b'])
  assert.deepEqual(ids({ exitCountry: 'DE' }), ['a'])
  assert.deepEqual(ids({ serverCountry: 'DE', exitCountry: 'DE' }), [])
  assert.deepEqual(ids({ exitCountry: '?' }), ['builtin'])
  assert.equal(checkedCountry({ status: 'failed', exitCountry: 'US' }, 'exitCountry'), '?')
  assert.equal(checkedCountry({ status: 'ok', exitCountry: 'XX' }, 'exitCountry'), '?')
})

test('proxy sorting is stable, puts unknown results last, and never mutates the catalog', () => {
  assert.deepEqual(ids({ sort: 'name' }), ['a', 'b', 'builtin'])
  assert.deepEqual(ids({ sort: 'latency' }), ['a', 'b', 'builtin'])
  assert.deepEqual(ids({ sort: 'serverCountry' }), ['b', 'a', 'builtin'])
  assert.deepEqual(ids({ sort: 'exitCountry' }), ['a', 'b', 'builtin'])
  assert.deepEqual(ids({}), ['builtin', 'b', 'a'])
})
