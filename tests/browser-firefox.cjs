const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createServer } = require('node:http')
const { spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const os = require('node:os')
const path = require('node:path')
const load = require('./load.cjs')
const { getPacScript } = load('background/pac')

test('Firefox PAC reaches the selected proxy and does not bypass an empty pool', { timeout: 60000 }, async () => {
  const hits = { direct: 0, proxy: 0 }
  let report
  const origin = createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*')
    if (request.url.startsWith('/report?')) {
      report(new URL(request.url, 'http://localhost').searchParams.get('result'))
      response.end('OK')
    } else if (request.url === '/start') {
      response.setHeader('Content-Type', 'text/html')
      response.end(`<script>
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 5000);
        fetch('http://route.example.com:${origin.address().port}/probe', { signal: controller.signal })
          .then(response => response.text(), error => error.name === 'AbortError' ? 'TIMEOUT' : 'BLOCKED')
          .then(result => { clearTimeout(timer); fetch('/report?result=' + result); });
      </script>`)
    } else if (request.url === '/probe') {
      hits.direct++; response.end('DIRECT')
    } else {
      response.end('')
    }
  })
  const proxy = createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*')
    hits.proxy++; response.end('PROXY')
  })
  await Promise.all([origin, proxy].map(server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve))))
  try {
    for (const mode of ['direct', 'proxy', 'blocked']) {
      const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'ct-firefox-pac-'))
      const data = getPacScript({ domains: mode === 'direct' ? [] : ['route.example.com'],
        proxies: mode === 'proxy' ? [{ protocol: 'HTTP', host: '127.0.0.1', port: proxy.address().port }] : [] })
      const prefs = {
        'network.proxy.type': 2,
        'network.proxy.autoconfig_url': 'data:application/x-ns-proxy-autoconfig,' + encodeURIComponent(data),
        'network.proxy.no_proxies_on': '',
        'network.dns.localDomains': 'route.example.com,harness.local',
        'network.trr.mode': 5,
        'browser.shell.checkDefaultBrowser': false,
        'browser.startup.homepage_override.mstone': 'ignore',
        'datareporting.policy.dataSubmissionEnabled': false,
        'toolkit.telemetry.enabled': false,
      }
      await fs.writeFile(path.join(profile, 'user.js'), Object.entries(prefs)
        .map(([key, value]) => `user_pref(${JSON.stringify(key)}, ${JSON.stringify(value)});`).join('\n'))
      hits.direct = 0; hits.proxy = 0
      const result = new Promise(resolve => { report = resolve })
      const child = spawn(process.env.FIREFOX || 'firefox', ['--headless', '--no-remote', '--profile', profile,
        `http://harness.local:${origin.address().port}/start`],
      { stdio: 'ignore', env: { ...process.env, MOZ_DISABLE_CONTENT_SANDBOX: '1' } })
      let timer
      try {
        const outcome = await Promise.race([result, new Promise((resolve, reject) => {
          child.on('error', reject)
          child.on('exit', () => reject(new Error('Firefox exited before reporting')))
          timer = setTimeout(() => reject(new Error(`Firefox timed out: ${mode}`)), 18000)
        })])
        assert.equal(outcome, mode.toUpperCase(), mode)
        assert.equal(hits.direct > 0, mode === 'direct', mode)
        assert.equal(hits.proxy > 0, mode === 'proxy', mode)
      } finally {
        clearTimeout(timer)
        if (child.exitCode === null && child.signalCode === null) {
          child.kill('SIGKILL')
          await new Promise(resolve => child.once('exit', resolve))
        }
        await fs.rm(profile, { recursive: true, force: true })
      }
    }
  } finally {
    for (const server of [origin, proxy]) { server.closeAllConnections(); server.close() }
  }
})
