const assert = require('node:assert/strict')
const { test } = require('node:test')
const load = require('./load.cjs')

test('IP probes validate HTTPS service data and keep request and byte limits', async () => {
  let response = { ip: '8.8.8.8', cc: 'US' }
  const requests = []
  const { probeProxy } = load('background/proxy-check-network', {
    request: { requestText: async (url, options) => { requests.push({ url, ...options }); return JSON.stringify(response) } },
  })
  const controller = new AbortController()
  const result = await probeProxy('https://api.myip.com/', controller.signal)
  assert.equal(result.exitIP, '8.8.8.8')
  assert.equal(result.exitCountry, 'US')
  assert.ok(result.latency >= 0)
  assert.equal(requests[0].timeout, 8000)
  assert.equal(requests[0].maxBytes, 65536)
  assert.equal(requests[0].redirect, 'error')
  for (const data of [{ ip: '192.168.1.1' }, { ip: '8.8.8.8', success: false }, {}, null]) {
    response = data
    await assert.rejects(probeProxy('https://api.myip.com/', controller.signal))
  }
})

test('location queries resolve only the proxy hostname and preserve unknown locations on API failure', async () => {
  const requests = []
  const { locateProxy } = load('background/proxy-check-network', {
    request: { requestText: async url => {
      requests.push(url)
      if (url.includes('dns-query')) return JSON.stringify({ Status: 0, Answer: [{ type: 1, data: '9.9.9.9' }] })
      if (url.includes('9.9.9.9')) return JSON.stringify({ ip: '9.9.9.9', country: 'DE' })
      throw new Error('Location service unavailable')
    } },
  })
  const result = await locateProxy({ host: 'proxy.example' }, { status: 'ok', exitIP: '8.8.8.8', exitCountry: '' }, new AbortController().signal)
  assert.equal(result.status, 'ok')
  assert.equal(result.serverIP, '9.9.9.9')
  assert.equal(result.serverCountry, 'DE')
  assert.equal(result.exitCountry, '')
  assert.equal(requests.filter(url => url.includes('dns-query')).length, 1)
  assert.equal(new URL(requests[0]).searchParams.get('name'), 'proxy.example')
  requests.length = 0
  await locateProxy({ host: '[::1]' }, { exitIP: '8.8.8.8', exitCountry: 'US' }, new AbortController().signal)
  assert.equal(requests.length, 0)
})
