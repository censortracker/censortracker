const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const { parseAnticensority } = load('background/anticensority')
const { registrySourceUrls, validateRegistrySource } = load('background/registry-source-data')
const pack = names => {
  const HOSTNAMES = {}
  for (const name of names) HOSTNAMES[name.length] = (HOSTNAMES[name.length] || '') + name
  return 'const inputs = ' + JSON.stringify({HOSTNAMES, IPS: {'8.8.8.8': true}, MASKED_SUBNETS: []}) + ';\n'
}

test('Anticensority reads static packed full hostnames, never PAC code or local proxy directives', async () => {
  const text = 'globalThis.executed = true;\n' + pack(['example.co.uk', 'child.example.com.br', 'ПРИМЕР.РФ', 'burs&', 'bad/path', '10.0.0.1']) +
    'function FindProxyForURL(){return "SOCKS5 localhost:9050; DIRECT";}\n'
  assert.deepEqual(Array.from(await parseAnticensority(text)), ['xn--e1afmkfd.xn--p1ai', 'example.co.uk', 'child.example.com.br'])
  assert.equal(globalThis.executed, undefined)
  for (const body of ['<html>offline</html>', pack([]), pack(['invalid&']), pack(['valid.example']) + pack(['second.example']),
    'const inputs = {"HOSTNAMES":{"0":"abc"}};', 'const inputs = {"HOSTNAMES":{"5":"abc"}};',
    'const inputs = {"HOSTNAMES":[]};', 'const inputs = {"HOSTNAMES":{"254":""}};',
    'const inputs = (function(){throw 1})();']) await assert.rejects(async () => parseAnticensority(body))
  const controller = new AbortController()
  controller.abort()
  await assert.rejects(parseAnticensority(pack(['example.com']), controller.signal))
})

test('published source URLs cannot be replaced by backup data', () => {
  const source = {kind: 'anticensority', url: registrySourceUrls.anticensority, enabled: true, autoUpdate: true}
  assert.equal(validateRegistrySource(source).url, registrySourceUrls.anticensority)
  assert.throws(() => validateRegistrySource({...source, url: 'https://other.example/list'}))
  assert.throws(() => validateRegistrySource({...source, kind: '__proto__'}))
})

test('large registry lookups share an index, yield during construction, and discard stale builds', async () => {
  const storage = {domains: Array.from({length: 10000}, (_,i) => 'site' + i + '.example'), customProxiedDomains: [], ignoredHosts: []}
  let reads = 0
  let requested
  let changed
  let ticked = false
  let time = 0
  const browser = {storage: {local: {get: async defaults => {
    reads++
    requested = Object.keys(defaults)
    return structuredClone(Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, storage[key] ?? value])))
  }},
    onChanged: {addListener: listener => { changed = listener }}}}
  const loaded = load('background/registry', {'browser-api': {default: browser}}, {
    performance: {now: () => time += 8},
  })
  loaded.watchRegistry()
  const registry = loaded.default
  const first = registry.getDomainStatus('site9999.example')
  const concurrent = registry.getDomainStatus('site2.example')
  setTimeout(() => { ticked = true; storage.domains = ['new.example']; changed({domains: {}}, 'local') }, 0)
  assert.equal((await first).blocked, false)
  assert.equal((await concurrent).blocked, false)
  assert.equal(ticked, true)
  assert.equal(reads, 2)
  assert.equal((await registry.getDomainStatus('new.example')).blocked, true)
  assert.equal(reads, 2)
  storage.ignoredHosts = ['new.example']
  changed({ignoredHosts: {}}, 'local')
  assert.equal((await registry.getDomainStatus('new.example')).ignored, true)
  assert.equal(reads, 3)
  assert.deepEqual(requested, ['ignoredHosts'])
  const get = browser.storage.local.get
  browser.storage.local.get = async () => { throw new Error('Read failed') }
  storage.customProxiedDomains = ['manual.example']
  changed({customProxiedDomains: {}}, 'local')
  await assert.rejects(registry.getDomainStatus('manual.example'), /Read failed/)
  browser.storage.local.get = get
  assert.equal((await registry.getDomainStatus('manual.example')).custom, true)
  assert.equal((await registry.getDomainStatus('new.example')).blocked, true)
  assert.deepEqual(requested, ['customProxiedDomains'])
})

test('concurrent requests share router construction and reject stale routing snapshots', async () => {
  let revision = 0
  let reads = 0
  let release
  const wait = new Promise(resolve => { release = resolve })
  const manager = load('background/proxy', {'browser-api': {default: {}}, registry: {default: {}},
    'proxy-route': {getRouteRevision: () => revision}}).default
  manager.getRoutingOptions = async () => {
    reads++
    const options = {domains: ['protected.example'], proxies: revision === 0 ?
      [{id: 'old', protocol: 'HTTP', host: 'old.example', port: 80}] : [], probes: []}
    await wait
    return options
  }
  const requests = Array.from({length: 20}, () => manager.getRouteForHost('protected.example'))
  assert.equal(reads, 1)
  revision++
  release()
  assert.ok((await Promise.all(requests)).every(result => result.type === 'blocked'))
  assert.equal(reads, 2)
})
