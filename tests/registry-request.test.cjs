const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')
const { requestRegistry } = load('background/registry-request', { 'browser-api': {} })
const url = 'https://registry.example/list'
const cache = { url, finalUrl: url, etag: 'W/"1"' }
const plain = value => JSON.parse(JSON.stringify(value))

test('legacy abort signals support downloads and cancellation before or after HEAD', async () => {
  for (const stage of ['none', 'before', 'head']) {
    const signal = { aborted: stage === 'before' }
    const calls = []
    const pending = requestRegistry(url, cache, async method => {
      calls.push(method)
      signal.aborted = stage === 'head'
      return { ...cache, etag: '"2"', data: [] }
    }, signal)
    if (stage === 'none') await pending
    else await assert.rejects(pending, { name: 'AbortError' })
    assert.deepEqual(calls, stage === 'before' ? [] : stage === 'head' ? ['HEAD'] : ['HEAD', 'GET'])
  }
})

test('registry ETags require the same source URL and final URL', async () => {
  for (const [saved, headers, methods] of [
    [null, cache, ['GET']], [{}, cache, ['GET']],
    [{ ...cache, url: url + '?region=BY' }, cache, ['GET']],
    [cache, cache, ['HEAD']],
    [cache, { ...cache, finalUrl: url + '/new' }, ['HEAD', 'GET']],
    [cache, { ...cache, etag: '"2"' }, ['HEAD', 'GET']],
    [cache, { ...cache, etag: '' }, ['HEAD', 'GET']],
  ]) {
    const calls = []
    const result = await requestRegistry(url, saved, async method => {
      calls.push(method)
      return { ...headers, data: [] }
    })
    assert.deepEqual(calls, methods)
    if (methods.length === 1 && methods[0] === 'HEAD') {
      assert.deepEqual(plain(result), { unchanged: true })
    } else {
      assert.deepEqual(plain(result.data), [])
      assert.equal(result.cache.etag, headers.etag)
    }
  }
})

test('failed HEAD falls back to GET, but cancellation and revoked consent stop', async () => {
  for (const name of ['Error', 'TimeoutError', 'AbortError', 'ConsentRequiredError']) {
    const calls = []
    const request = requestRegistry(url, cache, async method => {
      calls.push(method)
      if (method === 'HEAD') throw new Error('wrapped', {
        cause: Object.assign(new Error('failed'), { name }),
      })
      return { data: [], ...cache }
    })
    if (['AbortError', 'ConsentRequiredError'].includes(name)) {
      await assert.rejects(request)
      assert.deepEqual(calls, ['HEAD'])
    } else {
      await request
      assert.deepEqual(calls, ['HEAD', 'GET'])
    }
  }
})

test('failed GET leaves the saved validator unchanged', async () => {
  const saved = { ...cache }
  await assert.rejects(requestRegistry(url, saved, async method => {
    if (method === 'HEAD') return { ...cache, etag: '"2"' }
    throw new Error('invalid body')
  }))
  assert.deepEqual(saved, cache)
})
