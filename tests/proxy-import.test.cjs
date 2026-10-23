const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const { parseProxyInput, parseProxyImport } = load('background/proxy-import')

test('proxy import parses explicit protocols and credentials without relaxing endpoint validation', () => {
  const proxy = parseProxyInput('socks5://alice:p%40ss@ПРОКСИ.РФ:1080')
  assert.equal(proxy.protocol, 'SOCKS5')
  assert.equal(proxy.host, 'xn--h1adldfi.xn--p1ai')
  assert.equal(proxy.password, 'p@ss')
  assert.equal(parseProxyInput('[::1]:8080', 'HTTP').host, '[::1]')
  for (const value of ['ftp://host:80', 'https://host:443/path', 'host:0',
    'host:80; DIRECT', 'http://a:%0a@host:80', 'http://a:%ZZ@host:80']) {
    assert.throws(() => parseProxyInput(value), value)
  }
})

test('list import deduplicates endpoints, limits work, and reports invalid entries', () => {
  const result = parseProxyImport('# comment\nhttp://one.example:80 http://ONE.EXAMPLE:80\nbad\nhttp://two.example:80\nhttp://three.example:80', { limit: 2 })
  assert.equal(result.proxies.length, 2)
  assert.equal(result.skipped, 2)
  assert.equal(result.truncated, true)
  assert.equal(result.fromPac, false)
})

test('PAC import reads static strings, excludes local endpoints, and never executes code', () => {
  const result = parseProxyImport(`
    // "PROXY comment.example:80"
    /* "PROXY comment2.example:80" */
    globalThis.executed = true;
    function FindProxyForURL() { return "PROXY proxy.example:80; SOCKS5 [::1]:1080; DIRECT"; }
    var escaped = 'HTTPS pro\\x78y.example:443';
  `)
  assert.deepEqual(Array.from(result.proxies, proxy => proxy.host), ['proxy.example', 'proxy.example'])
  assert.ok(result.proxies.every(proxy => proxy.restricted))
  assert.equal(globalThis.executed, undefined)
  assert.equal(parseProxyImport('function FindProxyForURL() { /* unterminated').proxies.length, 0)
})

test('assigned and computed PAC functions cannot fall through to unrestricted list parsing', () => {
  for (const name of ['var FindProxyForURL', 'globalThis["Find" + "ProxyForURL"]']) {
    const result = parseProxyImport(`${name} = function(url, host) { return "PROXY one.example:80; PROXY two.example:80; DIRECT"; };`)
    assert.equal(result.fromPac, true)
    assert.equal(result.proxies.length, 2)
    assert.ok(result.proxies.every(proxy => proxy.restricted && proxy.protocol === 'HTTP'))
  }
  assert.equal(parseProxyImport('# user\'s comment\n // "comment"\nhttp://one.example:80').fromPac, false)
  assert.equal(parseProxyImport('http://a:p%22ss@one.example:80').proxies[0].password, 'p"ss')
})

test('invalid and duplicate candidates have a work limit independent of accepted proxies', () => {
  for (const token of ['x ', 'http://one.example:80 ']) {
    const result = parseProxyImport(token.repeat(10001))
    assert.equal(result.truncated, true)
    assert.equal(result.skipped + result.proxies.length, 10000)
  }
})
