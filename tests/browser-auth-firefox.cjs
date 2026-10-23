const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createServer } = require('node:http')
const net = require('node:net')
const { spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const buildFixture = require('./build-fixture.cjs')

test('Firefox routes a large registry, authenticates proxies, and inspects page resources', { timeout: 60000 }, async () => {
  const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'ct-firefox-auth-'))
  const profile = path.join(temporary, 'profile')
  const addon = path.join(temporary, 'addon')
  await Promise.all([profile, addon].map(directory => fs.mkdir(directory)))
  let report
  let directHits = 0
  let knockHits = 0
  const socksRequests = []
  const socks4Requests = []
  const sockets = new Set()
  const origin = createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', '*')
    if (request.url === '/related-page') {
      response.setHeader('Content-Type', 'text/html')
      response.end(`<script>fetch('http://cdn.related.example:${origin.address().port}/related-asset').then(() => document.title = 'Related ready')</script>`)
      return
    }
    if (request.url.startsWith('/report?')) {
      report(JSON.parse(new URL(request.url, 'http://localhost').searchParams.get('data')))
    } else if (request.url === '/probe') {
      directHits++
    }
    response.end('DIRECT')
  })
  const httpProxy = createServer((request, response) => {
    if (request.headers['proxy-authorization'] !== 'Basic ' + Buffer.from('alice:secret').toString('base64')) {
      response.writeHead(407, { 'Proxy-Authenticate': 'Basic realm="test"' })
      response.end('AUTH REQUIRED')
    } else {
      response.end('AUTH_HTTP')
    }
  })
  const socksProxy = net.createServer(socket => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => {})
    let buffer = Buffer.alloc(0)
    let stage = 'greeting'
    socket.on('data', data => {
      buffer = Buffer.concat([buffer, data])
      if (stage === 'greeting' && buffer.length >= 2 + buffer[1]) {
        const methods = buffer.subarray(2, 2 + buffer[1])
        buffer = buffer.subarray(2 + buffer[1])
        if (!methods.includes(2)) { socket.end(Buffer.from([5, 255])); return }
        socket.write(Buffer.from([5, 2])); stage = 'auth'
      }
      if (stage === 'auth' && buffer.length >= 3 + buffer[1]) {
        const userLength = buffer[1]
        const passwordLength = buffer[2 + userLength]
        if (buffer.length < 3 + userLength + passwordLength) return
        const username = buffer.subarray(2, 2 + userLength).toString()
        const password = buffer.subarray(3 + userLength, 3 + userLength + passwordLength).toString()
        buffer = buffer.subarray(3 + userLength + passwordLength)
        if (username !== 'alice' || password !== 'secret') {
          socket.end(Buffer.from([1, 1])); return
        }
        socket.write(Buffer.from([1, 0])); stage = 'connect'
      }
      if (stage === 'connect' && buffer.length >= 5) {
        const length = buffer[3] === 3 ? 7 + buffer[4] : buffer[3] === 1 ? 10 : 22
        if (buffer.length < length) return
        socksRequests.push({ addressType: buffer[3], hostname: buffer.subarray(5, 5 + buffer[4]).toString() })
        buffer = buffer.subarray(length)
        socket.write(Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, 0, 0])); stage = 'request'
      }
      if (stage === 'request' && buffer.includes('\r\n\r\n')) {
        stage = 'done'
        socket.end('HTTP/1.1 200 OK\r\nContent-Length: 10\r\nConnection: close\r\n\r\nAUTH_SOCKS')
      }
    })
  })
  const socks4Proxy = net.createServer(socket => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.on('error', () => {})
    let buffer = Buffer.alloc(0)
    let connected = false
    socket.on('data', data => {
      buffer = Buffer.concat([buffer, data])
      if (!connected && buffer.length >= 9) {
        const end = buffer.indexOf(0, 8)
        if (end < 0) return
        const address = Array.from(buffer.subarray(4, 8)).join('.')
        socks4Requests.push(address)
        if (buffer[0] !== 4 || buffer[1] !== 1 || address !== '127.0.0.1') {
          socket.end(Buffer.from([0, 91, 0, 0, 0, 0, 0, 0])); return
        }
        buffer = buffer.subarray(end + 1)
        connected = true
        socket.write(Buffer.from([0, 90, 0, 0, 127, 0, 0, 1]))
      }
      if (connected && buffer.includes('\r\n\r\n')) {
        socket.end('HTTP/1.1 200 OK\r\nContent-Length: 6\r\nConnection: close\r\n\r\nSOCKS4')
      }
    })
  })
  // A knock port can close the connection as soon as it receives a packet.
  const knockServer = net.createServer(socket => { knockHits++; socket.destroy() })
  const servers = [origin, httpProxy, socksProxy, socks4Proxy, knockServer]
  let child
  let remote
  let timer
  try {
    await Promise.all(servers.map(server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve))))
    const root = path.resolve(__dirname, '../src/shared/js/background')
    const cases = [
      { protocol: 'HTTP', port: httpProxy.address().port, password: 'secret' },
      { protocol: 'SOCKS5', port: socksProxy.address().port, password: 'secret' },
      { protocol: 'SOCKS5', port: socksProxy.address().port, password: 'wrong' },
      { protocol: 'SOCKS4', port: socks4Proxy.address().port, username: '', password: '' },
    ]
    const entry = path.join(temporary, 'entry.js')
    await fs.writeFile(entry, `
      import browser from ${JSON.stringify(path.join(root, 'browser-api.ts'))};
      import manager, { watchProxyCache } from ${JSON.stringify(path.join(root, 'proxy.ts'))};
      import { registerProxyAuth } from ${JSON.stringify(path.join(root, 'proxy-auth.ts'))};
      import { setProbeRoute, watchRoutes, withProxyLock } from ${JSON.stringify(path.join(root, 'proxy-route.ts'))};
      import { watchRegistry } from ${JSON.stringify(path.join(root, 'registry.ts'))};
      import { findRelatedDomains } from ${JSON.stringify(path.join(root, 'related-domains.ts'))};
      watchRoutes();
      watchRegistry();
      watchProxyCache();
      registerProxyAuth();
      (async () => {
        const results = [];
        const errors = [];
        console.error = (...args) => errors.push(args.join(' '));
        try {
          await browser.storage.local.set({ dataConsent: { version: 1, accepted: true }, enableExtension: true, useProxy: true, proxyAll: true,
            selectedProxyIds: ['test'], proxies: [{ id: 'test', protocol: 'HTTP', host: '127.0.0.1',
              port: ${httpProxy.address().port}, username: 'alice', password: 'secret' }] });
          await manager.setProxyInBackground({ ping: false });
          for (const host of ['knock.example', 'new-knock.example']) {
            await browser.storage.local.set({proxyPingURI: host + ':${knockServer.address().port}'});
            const original = (await browser.proxy.settings.get({})).value.autoConfigUrl;
            await withProxyLock(() => manager.pingInBackground(true));
            if ((await browser.storage.local.get('serviceRouteSnapshot')).serviceRouteSnapshot ||
                (await browser.proxy.settings.get({})).value.autoConfigUrl !== original) {
              throw new Error('The knock route was not restored');
            }
          }
          await browser.storage.local.set({proxyAll: false, proxyPingURI: null});
          await browser.storage.local.set({domains: Array.from({length: 660000}, (_,i) => i === 659999 ? 'protected.example' : 'site' + i + '.large-registry.example')});
          await manager.setProxyInBackground({ ping: false });
          results.push(await fetch('http://direct.example:${origin.address().port}/probe')
            .then(response => response.text()));
          for (const config of ${JSON.stringify(cases)}) {
            await browser.storage.local.set({ enableExtension: true, useProxy: true,
              customProxiedDomains: [], selectedProxyIds: ['test'],
              proxies: [{ id: 'test', host: '127.0.0.1', username: 'alice', ...config }] });
            if (!await manager.setProxyInBackground()) throw new Error('PAC was not applied: ' + errors.join('; '));
            const setting = await browser.proxy.settings.get({});
            if (setting.value.autoConfigUrl.length > 1000) throw new Error('Firefox needs a small fallback PAC');
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 6000);
            try {
              results.push(await fetch('http://protected.example:${origin.address().port}/probe',
                { signal: controller.signal, cache: 'no-store' }).then(response => response.text()));
            } catch (error) { results.push(error.name === 'AbortError' ? 'TIMEOUT' : 'BLOCKED'); }
            finally { clearTimeout(timeout); }
          }
          await browser.storage.local.set({ selectedProxyIds: [] });
          results.push(await fetch('http://protected.example:${origin.address().port}/probe')
            .then(response => response.text(), () => 'BLOCKED'));
          for (const config of ${JSON.stringify(cases.slice(0, 2))}) {
            setProbeRoute('protected.example', { id: 'probe', host: '127.0.0.1', username: 'alice', ...config });
            if (!await manager.setProxyInBackground({ ping: false })) throw new Error('Probe PAC was not applied');
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 6000);
            try {
              results.push(await fetch('http://protected.example:${origin.address().port}/probe',
                { signal: controller.signal, cache: 'no-store' }).then(response => response.text()));
            } catch (error) { results.push(error.name === 'AbortError' ? 'TIMEOUT' : 'BLOCKED'); }
            finally { clearTimeout(timeout); setProbeRoute('protected.example', null); }
          }
          await manager.setProxyInBackground({ ping: false });
          await browser.storage.local.set({useProxy: false});
          await manager.removeProxyInBackground();
          const url = 'http://page.related.example:${origin.address().port}/related-page';
          const tab = await browser.tabs.create({url, active: false});
          for (let i = 0; i < 100; i++) {
            if ((await browser.tabs.get(tab.id)).title === 'Related ready') break;
            await new Promise(resolve => setTimeout(resolve, 50));
          }
          results.push((await findRelatedDomains({tabId: tab.id, url})).join(','));
          await browser.tabs.remove(tab.id);
        } catch (error) { results.push(error.message); }
        await fetch('http://127.0.0.1:${origin.address().port}/report?data=' + encodeURIComponent(JSON.stringify(results)));
      })();
    `)
    await buildFixture(entry, addon)
    await fs.writeFile(path.join(addon, 'manifest.json'), JSON.stringify({ manifest_version: 2,
      name: 'Isolated authentication test', version: '1', browser_action: {},
      browser_specific_settings: { gecko: { id: 'auth-test@censortracker.invalid' } },
      background: { scripts: ['background.js'] },
      permissions: ['<all_urls>', 'storage', 'proxy', 'webRequest', 'webRequestBlocking', 'tabs'],
    }))
    await fs.writeFile(path.join(profile, 'user.js'), Object.entries({
      'devtools.debugger.remote-enabled': true,
      'devtools.chrome.enabled': true,
      'devtools.debugger.prompt-connection': false,
      'network.dns.localDomains': 'direct.example,protected.example,page.related.example,cdn.related.example,knock.example,new-knock.example',
      'network.trr.mode': 5,
      'datareporting.policy.dataSubmissionEnabled': false,
      'toolkit.telemetry.enabled': false,
    }).map(([key, value]) => `user_pref(${JSON.stringify(key)}, ${JSON.stringify(value)});`).join('\n'))
    await fs.writeFile(path.join(profile, 'extension-preferences.json'), JSON.stringify({
      'auth-test@censortracker.invalid': { permissions: ['internal:privateBrowsingAllowed'], origins: [] },
    }))
    const { connectWithMaxRetries, findFreeTcpPort } = await import('../node_modules/web-ext/lib/firefox/remote.js')
    const port = await findFreeTcpPort()
    const results = new Promise(resolve => { report = resolve })
    child = spawn(process.env.FIREFOX || 'firefox', ['--headless', '--no-remote', '--profile', profile,
      '--start-debugger-server', String(port), 'about:blank'],
    { stdio: 'ignore', env: { ...process.env, MOZ_DISABLE_CONTENT_SANDBOX: '1' } })
    const failure = new Promise((resolve, reject) => {
      child.on('error', reject)
      child.on('exit', () => reject(new Error('Firefox exited early')))
      timer = setTimeout(() => reject(new Error('Firefox integration test timed out')), 45000)
    })
    const run = async () => {
      remote = await connectWithMaxRetries({ port, maxRetries: 50, retryInterval: 100 })
      await remote.installTemporaryAddon(addon)
      return results
    }
    assert.deepEqual(await Promise.race([run(), failure]), ['DIRECT', 'AUTH_HTTP', 'AUTH_SOCKS', 'BLOCKED', 'SOCKS4', 'BLOCKED', 'AUTH_HTTP', 'AUTH_SOCKS', 'cdn.related.example'])
    assert.equal(directHits, 1)
    assert.ok(knockHits >= 2, 'Both knock endpoints must receive a direct connection')
    assert.ok(socksRequests.length > 0)
    assert.ok(socksRequests.every(request => request.addressType === 3 && request.hostname === 'protected.example'))
    assert.ok(socks4Requests.length > 0)
    assert.ok(socks4Requests.every(address => address === '127.0.0.1'))
  } finally {
    clearTimeout(timer)
    if (remote) remote.disconnect()
    if (child && child.exitCode === null && child.signalCode === null) {
      child.kill('SIGKILL')
      await new Promise(resolve => child.once('exit', resolve))
    }
    for (const socket of sockets) socket.destroy()
    for (const server of servers) { server.closeAllConnections?.(); server.close() }
    await fs.rm(temporary, { recursive: true, force: true })
  }
})
