const assert = require('node:assert/strict')
const { test } = require('node:test')
const http = require('node:http')
const load = require('./load.cjs')

const { requestText } = load('background/request', { 'browser-api': { default: {
  storage: { local: { get: async () => ({ dataConsent: { version: 1, accepted: true } }) },
    onChanged: { addListener() {}, removeListener() {} } },
} } })

async function serverTest(handler, run) {
  const server = http.createServer(handler)
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  try {
    await run('http://127.0.0.1:' + server.address().port)
  } finally {
    server.closeAllConnections()
    await new Promise(resolve => server.close(resolve))
  }
}

test('deadline covers delayed headers and an unfinished response body', async () => {
  for (const headers of [false, true]) {
    await serverTest((req, res) => {
      if (headers) { res.writeHead(200); res.write('unfinished') }
    }, async url => {
      await assert.rejects(requestText(url, { timeout: 50 }), /abort/i)
    })
  }
})

test('caller cancellation interrupts an active response body', async () => {
  const controller = new AbortController()
  await serverTest((req, res) => {
    res.write('partial')
    controller.abort()
  }, url => assert.rejects(requestText(url, { signal: controller.signal }), /abort/i))
})

test('reject HTTP errors and limit actual bytes without Content-Length', async () => {
  await serverTest((req, res) => res.writeHead(503).end('error'),
    url => assert.rejects(requestText(url), /HTTP 503/))
  await serverTest((req, res) => { res.write('1234'); res.end('5678') },
    url => assert.rejects(requestText(url, { maxBytes: 6 }), /too large/))
})

test('decode Unicode across chunks and return a complete response', async () => {
  await serverTest((req, res) => {
    const bytes = Buffer.from('пример.рф')
    res.write(bytes.subarray(0, 1))
    setTimeout(() => res.end(bytes.subarray(1)), 5)
  }, async url => assert.equal(await requestText(url), 'пример.рф'))
})

test('an already cancelled request never reaches the server', async () => {
  const controller = new AbortController()
  controller.abort()
  await serverTest(() => assert.fail('unexpected request'),
    url => assert.rejects(requestText(url, { signal: controller.signal }), /abort/i))
})

test('HEAD returns metadata without reading a body; GET can return metadata', async () => {
  const methods = []
  await serverTest((req, res) => {
    methods.push(req.method)
    res.setHeader('ETag', '"v1"')
    res.end('example.com')
  }, async url => {
    assert.deepEqual(JSON.parse(JSON.stringify(await requestText(url, { method: 'HEAD' }))),
      { etag: '"v1"', finalUrl: url + '/' })
    assert.deepEqual(JSON.parse(JSON.stringify(await requestText(url, { metadata: true }))),
      { data: 'example.com', etag: '"v1"', finalUrl: url + '/' })
  })
  assert.deepEqual(methods, ['HEAD', 'GET'])
})
