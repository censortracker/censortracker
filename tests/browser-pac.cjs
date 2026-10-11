const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createServer } = require('node:http')
const { createServer: createSecureServer } = require('node:https')
const { spawn, execFile } = require('node:child_process')
const { promisify } = require('node:util')
const { createHash } = require('node:crypto')
const { connect } = require('node:net')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const load = require('./load.cjs')

const within = (promise, milliseconds = 5000) => {
  let timer
  return Promise.race([promise, new Promise((resolve, reject) => {
    timer = setTimeout(() => reject(new Error('Browser test operation timed out')), milliseconds)
  })]).finally(() => clearTimeout(timer))
}

// An isolated browser and local servers: no public proxy or destination is used.
test('Chromium applies PAC rules and manages proxies', { timeout: 60000 }, async (context) => {
  const build = global.process.env.CT_BROWSER_BUILD === 'dev' ? 'dev' : 'prod'
  const extension = global.process.env.CT_EXTENSION_DIR || require('../tasks/build-path.cjs')('chrome', build)
  const id = createHash('sha256').update(extension).digest('hex').slice(0, 32)
    .replace(/[0-9a-f]/g, digit => String.fromCharCode(97 + parseInt(digit, 16)))
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'ct-pac-test-'))
  let directHits = 0
  let registryHits = 0
  let relatedHits = 0
  const origin = createServer((request, response) => {
    directHits++
    response.setHeader('Access-Control-Allow-Origin', '*')
    if (request.url === '/related-page') {
      response.setHeader('Content-Type', 'text/html')
      response.end(`<script>Promise.all(['cdn.related.example', 'api.related.example'].map(host =>
        fetch('http://' + host + ':${origin.address().port}/related-asset'))).then(() => document.title = 'Related ready')</script>`)
      return
    }
    if (request.url === '/related-asset') relatedHits++
    if (request.url.startsWith('/registry-list')) {
      registryHits++
      response.end('external.example\ncdn.example.co.uk')
    } else response.end('DIRECT')
  })
  let authHits = 0
  const proxyHandler = (request, response) => {
    if (request.url.includes('auth.example')) {
      if (request.headers['proxy-authorization'] !== 'Basic ' + Buffer.from('alice:secret').toString('base64')) {
        response.writeHead(407, { 'Proxy-Authenticate': 'Basic realm="test"' })
        response.end('AUTH REQUIRED')
        return
      }
      authHits++
    }
    response.end('PROXY')
  }
  const proxy = createServer(proxyHandler)
  let localApi
  let secureProxy
  let echo
  let echoHits = 0
  let knockTunnels = 0
  let slowEcho = false
  await Promise.all([origin, proxy].map(server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve))))
  const process = spawn(global.process.env.CHROMIUM || 'chromium', [
    ...(global.process.env.CT_CHROMIUM_HEADLESS === 'off' ? [] : [`--headless=${global.process.env.CT_CHROMIUM_HEADLESS || 'new'}`]), '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
    '--ignore-certificate-errors', // Only the isolated test uses a self-signed proxy.
    '--disable-background-networking', '--disable-component-update',
    '--disable-background-timer-throttling', '--disable-renderer-backgrounding',
    '--disable-backgrounding-occluded-windows',
    '--host-resolver-rules=MAP * 127.0.0.1, EXCLUDE localhost',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`,
    `--disable-extensions-except=${extension}`, `--load-extension=${extension}`, 'about:blank',
  ], { stdio: 'ignore' })
  let socket
  let startError
  process.on('error', error => { startError = error })
  try {
    const key = path.join(profile, 'proxy-key.pem')
    const cert = path.join(profile, 'proxy-cert.pem')
    await promisify(execFile)('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', key, '-out', cert, '-subj', '/CN=localhost', '-days', '1'], { timeout: 5000 })
    secureProxy = createSecureServer({ key: await fs.readFile(key), cert: await fs.readFile(cert) }, proxyHandler)
    await new Promise(resolve => secureProxy.listen(0, '127.0.0.1', resolve))
    echo = createSecureServer({ key: await fs.readFile(key), cert: await fs.readFile(cert) }, (request, response) => {
      echoHits++
      if (!slowEcho) response.end(JSON.stringify({ ip: '8.8.8.8', cc: 'US' }))
    })
    await new Promise(resolve => echo.listen(0, '127.0.0.1', resolve))
    const tunnel = (request, client, head) => {
      if (request.url.includes('knock.example:')) knockTunnels++
      if (request.headers['proxy-authorization'] !== 'Basic ' + Buffer.from('alice:secret').toString('base64')) {
        client.end('HTTP/1.1 407 Proxy Authentication Required\r\nProxy-Authenticate: Basic realm="probe"\r\nContent-Length: 0\r\n\r\n')
        return
      }
      const upstream = connect(echo.address().port, '127.0.0.1', () => {
        client.write('HTTP/1.1 200 Connection Established\r\n\r\n')
        upstream.write(head)
        client.pipe(upstream).pipe(client)
      })
      client.on('error', () => upstream.destroy())
      upstream.on('error', () => client.destroy())
      client.on('close', () => upstream.destroy())
    }
    proxy.on('connect', tunnel)
    secureProxy.on('connect', tunnel)
    let port
    for (let attempt = 0; attempt < 100; attempt++) {
      if (startError) throw startError
      try { port = (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; break } catch {}
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    assert.ok(port, 'Chromium did not start')
    const endpoint = `http://localhost:${port}`
    const target = await fetch(`${endpoint}/json/new?${encodeURIComponent(`chrome-extension://${id}/options.html`)}`,
      { method: 'PUT', signal: AbortSignal.timeout(5000) }).then(response => response.json())
    socket = new WebSocket(target.webSocketDebuggerUrl)
    await within(new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject }))
    let next = 0
    const pending = new Map()
    socket.onmessage = event => {
      const data = JSON.parse(event.data)
      if (data.id) { pending.get(data.id)(data); pending.delete(data.id) }
    }
    const command = async (method, params, sessionId) => {
      const result = await within(new Promise(resolve => {
        const id = ++next
        pending.set(id, resolve)
        socket.send(JSON.stringify({ id, method, params, sessionId }))
      }))
      assert.equal(result.error, undefined, JSON.stringify(result))
      return result.result
    }
    const evaluate = async (expression, sessionId) => {
      const result = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId)
        .catch(error => { error.message += ': ' + expression.slice(0, 160); throw error })
      assert.equal(result.exceptionDetails, undefined, JSON.stringify(result))
      return result.result.value
    }
    const fill = async (values) => {
      for (const [id, value] of Object.entries(values)) {
        await evaluate(`(() => {
          const input = document.getElementById(${JSON.stringify(id)});
          input.value = ${JSON.stringify(value)};
          input.dispatchEvent(new Event(input.tagName === 'SELECT' ? 'change' : 'input', {bubbles: true}));
        })()`)
      }
    }
    const until = async (expression, sessionId) => {
      for (let attempt = 0; attempt < 50; attempt++) {
        if (await evaluate(expression, sessionId)) return
        await new Promise(resolve => setTimeout(resolve, 50))
      }
      const editor = await evaluate("document.querySelector('.cm-editor')?.textContent", sessionId)
      assert.fail(`Page did not update: ${expression}${editor ? `\nEditor: ${editor}` : ''}`)
    }
    const checkSettingsLayout = async (name, expanded) => {
      const previous = await evaluate('Array.from(document.querySelectorAll("details"), node => [node.id, node.open])')
      await evaluate(`${JSON.stringify(expanded)}.forEach(id => { document.getElementById(id).open = true })`)
      for (const theme of ['light', 'dark']) {
        await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] })
        for (const width of [1200, 760, 360, 320]) {
          await command('Emulation.setDeviceMetricsOverride', { width, height: 1050, deviceScaleFactor: 1, mobile: false })
          const layout = await evaluate(`(() => {
            const visible = node => node.getBoundingClientRect().height > 0;
            const fields = Array.from(document.querySelectorAll('.settings-field, [class*="__settings-field__"]')).filter(visible);
            const buttons = Array.from(document.querySelectorAll('.settings-section button, [class*="__settings-section__"] button')).filter(visible);
            return {
              overflow: document.documentElement.scrollWidth > innerWidth,
              fields: fields.length,
              labelsAbove: fields.every(field => {
                const label = field.querySelector('label').getBoundingClientRect();
                const input = field.querySelector('input, select, textarea').getBoundingClientRect();
                return label.bottom <= input.top && input.right <= innerWidth;
              }),
              readableButtons: buttons.every(button => button.getBoundingClientRect().height >= 36),
              labelWeights: fields.every(field => Number(getComputedStyle(field.querySelector('label')).fontWeight) <= 600),
            };
          })()`)
          assert.ok(layout.fields > 0, name)
          assert.deepEqual({ ...layout, fields: 0 }, { overflow: false, fields: 0, labelsAbove: true, readableButtons: true, labelWeights: true }, `${name}, ${theme}, ${width}px`)
          if (global.process.env.CT_SETTINGS_SCREENSHOTS && width !== 320) {
            if (name === 'proxies') {
              await evaluate("['proxyFilters', 'proxyCheckOptions', 'proxyAuthOptions', 'proxyImportOptions'].forEach(id => { document.getElementById(id).open = false })")
            }
            await evaluate('scrollTo(0, 0)')
            await new Promise(resolve => setTimeout(resolve, 160))
            const { data } = await command('Page.captureScreenshot', { captureBeyondViewport: false })
            await fs.writeFile(path.join(global.process.env.CT_SETTINGS_SCREENSHOTS, `${name}-${theme}-${width}.png`), Buffer.from(data, 'base64'))
            await evaluate(`${JSON.stringify(expanded)}.forEach(id => { document.getElementById(id).open = true })`)
          }
        }
      }
      await evaluate(`${JSON.stringify(previous)}.forEach(([id, open]) => { document.getElementById(id).open = open })`)
      await command('Emulation.clearDeviceMetricsOverride', {})
      await command('Emulation.setEmulatedMedia', { features: [] })
    }
    await new Promise(resolve => setTimeout(resolve, 1000))
    const { getPacScript } = load('background/pac')
    const data = getPacScript({ domains: ['example.co.uk', 'api.example.com', 'example.com.br', 'printer.local', 'router'],
      ignoredHosts: ['api.example.co.uk', 'example.com.br'],
      proxies: [{ protocol: 'HTTP', host: '127.0.0.1', port: proxy.address().port }] })
    await evaluate(`chrome.proxy.settings.set(${JSON.stringify({ value: { mode: 'pac_script', pacScript: { data, mandatory: true } }, scope: 'regular' })})`)
    for (const [host, expected] of [
      ['example.co.uk', 'PROXY'], ['deep.api.example.com', 'PROXY'], ['a.example.com.br', 'DIRECT'],
      ['api.example.co.uk', 'DIRECT'],
      ['other.co.uk', 'DIRECT'], ['www.example.com', 'DIRECT'], ['badexample.com.br', 'DIRECT'],
      ['printer.local', 'DIRECT'], ['router', 'DIRECT'],
    ]) {
      assert.equal(await evaluate(`fetch(${JSON.stringify(`http://${host}:${origin.address().port}/`)}).then(response => response.text())`), expected, host)
    }
    const install = async data => evaluate(`chrome.proxy.settings.set(${JSON.stringify({
      value: { mode: 'pac_script', pacScript: { data, mandatory: true } }, scope: 'regular',
    })})`)
    await evaluate(`chrome.storage.local.set({ dataConsent: { version: 1, accepted: true }, enableExtension: true, useProxy: true,
      proxyAll: true, selectedProxyIds: ['builtin'],
      proxyServerURI: '127.0.0.1:${secureProxy.address().port}' })`)
    // Consent starts a mirror refresh. Wait for its final result before the PAC snapshot.
    await until("chrome.storage.local.get(['mirrorsError', 'mirrorsUpdatedAt']).then(data => data.mirrorsError || data.mirrorsUpdatedAt)")
    await evaluate("chrome.runtime.sendMessage({type: 'ct-background', action: 'setProxy'})")
    for (const host of ['knock.example', 'new-knock.example']) {
      await evaluate(`chrome.storage.local.set({proxyPingURI: '${host}:${echo.address().port}'})`)
      const original = await evaluate('chrome.proxy.settings.get({}).then(setting => setting.value)')
      const beforeKnock = echoHits
      assert.equal(await evaluate("chrome.runtime.sendMessage({type: 'ct-background', action: 'ping'}).then(result => result.error || 'OK')"), 'OK')
      // A startup task can also send a direct knock while this request runs.
      assert.ok(echoHits > beforeKnock, 'The knock must reach the server directly')
      assert.equal(knockTunnels, 0, 'The knock must not pass through the managed proxy')
      assert.deepEqual(await evaluate('chrome.proxy.settings.get({}).then(setting => setting.value)'), original)
      assert.equal(await evaluate("chrome.storage.local.get('serviceRouteSnapshot').then(data => !!data.serviceRouteSnapshot)"), false)
    }
    await evaluate('chrome.storage.local.set({proxyAll: false, proxyPingURI: null})')
    await install(getPacScript({ domains: ['blocked.example'] }))
    const before = directHits
    assert.equal(await evaluate(`fetch('http://blocked.example:${origin.address().port}/').then(() => 'LEAK', () => 'BLOCKED')`), 'BLOCKED')
    assert.equal(directHits, before)
    await install('function FindProxyForURL() { return "PROXY 127.0.0.1:0; PROXY 127.0.0.1:' + proxy.address().port + '" }')
    assert.equal(await evaluate(`fetch('http://failover.example:${origin.address().port}/').then(response => response.text())`), 'PROXY')
    for (const [protocol, server] of [['HTTP', proxy], ['HTTPS', secureProxy]]) {
      const beforeAuth = authHits
      await evaluate(`chrome.storage.local.set(${JSON.stringify({ enableExtension: true, useProxy: true,
        proxies: [{ id: 'auth', name: 'Authenticated', protocol, host: '127.0.0.1', port: server.address().port, username: 'alice', password: 'secret' }],
        selectedProxyIds: ['auth'], customProxiedDomains: ['auth.example'],
      })})`)
      assert.equal(await evaluate("chrome.runtime.sendMessage({type: 'ct-background', action: 'setProxy'}).then(result => result.error || result.value)"), true)
      const response = await evaluate(`fetch('http://auth.example:${origin.address().port}/${protocol}').then(response => response.text())`)
      if (response !== 'PROXY') {
        assert.match((await command('Browser.getVersion', {})).product, /^Chrome\/108\./)
        assert.equal(response, 'AUTH REQUIRED')
        context.diagnostic(`${protocol}: Chromium 108 needs website authentication before extension fetches`)
      }
      // Chromium 108 sends proxy auth events for website navigation, but not extension fetches.
      const { targetId } = await command('Target.createTarget', { url: 'about:blank' })
      try {
        const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true })
        await command('Page.enable', {}, sessionId)
        await command('Page.navigate', { url: `http://auth.example:${origin.address().port}/${protocol}` }, sessionId)
        await until("document.body?.textContent === 'PROXY'", sessionId)
      } finally {
        await command('Target.closeTarget', { targetId })
      }
      assert.ok(authHits > beforeAuth, protocol)
    }
    assert.equal(await evaluate("chrome.proxy.settings.get({}).then(({value}) => /alice|secret/.test(value.pacScript.data))"), false)
    const checkRecords = [['HTTP', proxy], ['HTTPS', secureProxy]].map(([protocol, server], index) => ({
      id: `check-${index}`, name: `Check ${index}`, protocol, host: '127.0.0.1', port: server.address().port, username: 'alice', password: 'secret',
    }))
    await evaluate(`chrome.storage.local.set(${JSON.stringify({ proxies: checkRecords, selectedProxyIds: ['check-0'] })})`)
    assert.equal(await evaluate("chrome.runtime.sendMessage({type: 'ct-background', action: 'startProxyChecks', args: {ids: ['check-0', 'check-1']}}).then(result => result.error || result.value.running)"), true)
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate("chrome.storage.local.get('proxyCheckRun').then(data => data.proxyCheckRun?.running === false)")) break
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    const results = await evaluate("chrome.storage.local.get('proxyChecks').then(data => data.proxyChecks)")
    assert.equal(results['check-0']?.status, 'ok', JSON.stringify(results))
    assert.equal(results['check-1']?.status, 'ok', JSON.stringify(results))
    assert.equal(results['check-0'].exitIP, '8.8.8.8')
    assert.equal(results['check-0'].exitCountry, 'US')
    assert.equal(await evaluate("chrome.proxy.settings.get({}).then(({value}) => value.pacScript.data.includes('api.ipify.org'))"), false)
    await evaluate(`chrome.storage.local.set({proxyFailures: {'check-0': {fingerprint: ${JSON.stringify(results['check-0'].fingerprint)}, retryAt: Date.now() + 300000}}})`)
    await evaluate("chrome.runtime.sendMessage({type: 'ct-background', action: 'setProxy'})")
    const beforeBlocked = directHits
    assert.equal(await evaluate(`fetch('http://auth.example:${origin.address().port}/cooldown').then(response => response.text(), () => 'BLOCKED')`), 'BLOCKED')
    assert.equal(directHits, beforeBlocked)
    await evaluate("chrome.runtime.sendMessage({type: 'ct-background', action: 'startProxyChecks', args: {ids: ['check-0']}})")
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate("chrome.storage.local.get('proxyCheckRun').then(data => data.proxyCheckRun?.running === false)")) break
      await new Promise(resolve => setTimeout(resolve, 50))
    }
    assert.equal(await evaluate("chrome.storage.local.get('proxyFailures').then(data => data.proxyFailures['check-0'])"), undefined)
    assert.equal(await evaluate(`fetch('http://auth.example:${origin.address().port}/recovered').then(response => response.text())`), 'PROXY')
    results['check-0'] = await evaluate("chrome.storage.local.get('proxyChecks').then(data => data.proxyChecks['check-0'])")
    const checkedAt = results['check-0'].checkedAt
    await evaluate("chrome.storage.local.set({customProxiedDomains: ['auth.example', 'country-auth.example']})")
    await evaluate("chrome.runtime.sendMessage({type: 'ct-background', action: 'siteCountryRule', args: {host: 'country-auth.example', countries: ['US']}})")
    const beforeCountryBlock = directHits
    assert.equal(await evaluate(`fetch('http://country-auth.example:${origin.address().port}/forbidden').then(response => response.text(), () => 'BLOCKED')`), 'BLOCKED')
    assert.equal(directHits, beforeCountryBlock)
    await evaluate("chrome.runtime.sendMessage({type: 'ct-background', action: 'siteCountryRule', args: {host: 'country-auth.example', countries: ['DE']}})")
    assert.equal(await evaluate(`fetch('http://country-auth.example:${origin.address().port}/permitted').then(response => response.text())`), 'PROXY')
    await evaluate("chrome.storage.local.get('proxyChecks').then(({proxyChecks}) => { proxyChecks['check-0'].checkedAt = 1; return chrome.storage.local.set({proxyChecks}) })")
    await evaluate("chrome.runtime.sendMessage({type: 'ct-background', action: 'setProxy'})")
    assert.equal(await evaluate(`fetch('http://country-auth.example:${origin.address().port}/expired-country').then(response => response.text(), () => 'BLOCKED')`), 'BLOCKED')
    assert.equal(directHits, beforeCountryBlock)
    await evaluate(`chrome.storage.local.get('proxyChecks').then(({proxyChecks}) => { proxyChecks['check-0'].checkedAt = ${checkedAt}; return chrome.storage.local.set({proxyChecks}) })`)
    await evaluate("chrome.runtime.sendMessage({type: 'ct-background', action: 'siteCountryRule', args: {host: 'country-auth.example', countries: null}})")
    const beforeSlow = echoHits
    slowEcho = true
    await evaluate("chrome.runtime.sendMessage({type: 'ct-background', action: 'startProxyChecks', args: {ids: ['check-0']}})")
    for (let attempt = 0; echoHits === beforeSlow && attempt < 100; attempt++) await new Promise(resolve => setTimeout(resolve, 20))
    assert.ok(echoHits > beforeSlow)
    await evaluate("chrome.runtime.sendMessage({type: 'ct-background', action: 'stopProxyChecks'})")
    assert.equal(await evaluate("chrome.storage.local.get('proxyChecks').then(data => data.proxyChecks['check-0'].checkedAt)"), checkedAt)
    assert.equal(await evaluate("chrome.storage.local.get('proxyProbeActive').then(data => data.proxyProbeActive)"), false)
    slowEcho = false
    const beforePopup = echoHits
    const siteTab = await evaluate(`chrome.tabs.create({url: 'http://auth.example:${origin.address().port}/popup', active: true}).then(tab => tab.id)`)
    await evaluate("location.href = chrome.runtime.getURL('popup.html')")
    await until("document.querySelector('#proxyRouteSummary')?.textContent.includes('Check 0')")
    assert.equal(await evaluate("document.querySelector('#proxyRouteExit').textContent.includes('8.8.8.8')"), true)
    assert.equal(await evaluate("document.querySelector('#proxyRouteExit').textContent.includes('United States')"), true)
    assert.equal(await evaluate("document.querySelector('#proxyingDetailsText').textContent.includes('Checked:')"), true)
    assert.equal(await evaluate("document.querySelector('#proxyingDetailsText').textContent.includes('secret')"), false)
    if (global.process.env.CT_POPUP_SCREENSHOT) {
      await command('Emulation.setDeviceMetricsOverride', { width: 315, height: 600, deviceScaleFactor: 1, mobile: false })
      const { data } = await command('Page.captureScreenshot', { captureBeyondViewport: true })
      await fs.writeFile(global.process.env.CT_POPUP_SCREENSHOT, Buffer.from(data, 'base64'))
      await command('Emulation.clearDeviceMetricsOverride', {})
    }
    await evaluate("chrome.runtime.sendMessage({type: 'ct-background', action: 'proxies', args: {operation: 'select', ids: []}})")
    await until("document.querySelector('#proxyRouteSummary').textContent.includes('No eligible proxy')")
    assert.equal(await evaluate("document.querySelector('#proxyRouteExit').textContent"), '')
    assert.equal(echoHits, beforePopup, 'Opening and refreshing the popup must not request an exit check')
    await evaluate(`chrome.tabs.remove(${siteTab})`)
    await evaluate("chrome.storage.local.set({useProxy: false, proxies: [], selectedProxyIds: ['builtin']})")
    await evaluate("location.href = chrome.runtime.getURL('proxy-options.html')")
    await until("document.querySelectorAll('#proxyRows tr').length === 1")
    const builtinAddress = await evaluate("chrome.storage.local.get('proxyServerURI').then(data => data.proxyServerURI)")
    const builtinFingerprint = await load('background/proxy-check-data').proxyFingerprint({ id: 'builtin', protocol: 'HTTPS',
      ...load('background/proxy-address').parseProxyAddress(builtinAddress) })
    await evaluate(`chrome.storage.local.get('proxyChecks').then(({proxyChecks = {}}) => chrome.storage.local.set({proxyChecks: {...proxyChecks,
      builtin: {status: 'failed', checkedAt: Date.now(), fingerprint: ${JSON.stringify(builtinFingerprint)},
        attempts: [{service: 'api.ipify.org', code: 'timeout'}, {service: 'api.myip.com', code: 'network', netError: 'net::ERR_PROXY_CONNECTION_FAILED'}]}}}))`)
    await until("document.querySelector('#proxyRows').textContent.includes('net::ERR_PROXY_CONNECTION_FAILED')")
    assert.match(await evaluate("document.querySelector('#proxyRows tr').cells[3].title"), /api\.ipify\.org: Request timeout/)
    assert.match(await evaluate("document.querySelector('#proxyRows tr').cells[3].title"), /api\.myip\.com: Network error/)
    await evaluate("chrome.storage.local.get('proxyChecks').then(({proxyChecks}) => {delete proxyChecks.builtin; return chrome.storage.local.set({proxyChecks})})")
    await until("!document.querySelector('#proxyRows').textContent.includes('net::ERR_PROXY_CONNECTION_FAILED')")
    assert.equal(await evaluate("document.querySelector('#proxyListOptions').open"), false)
    assert.equal(await evaluate("document.querySelector('#proxyPagination').hidden"), true)
    await evaluate("document.querySelector('#useProxyCheckbox').click()")
    await until("chrome.storage.local.get('useProxy').then(data => data.useProxy === true)")
    await checkSettingsLayout('proxies', ['proxyListOptions', 'proxyFilters', 'proxyCheckOptions', 'proxyAuthOptions', 'proxyImportOptions'])
    await command('Page.bringToFront', {})
    await evaluate("document.querySelector('#useDefaultProxy').focus()")
    assert.equal(await evaluate('document.activeElement.id'), 'useDefaultProxy', 'Proxy mode must be keyboard-accessible')
    await evaluate("document.querySelector('#proxyListOptions').open = true; document.querySelector('#select-toggle').focus()")
    assert.equal(await evaluate('document.activeElement.id'), 'select-toggle')
    // macOS native select menus do not handle CDP End-key events.
    if (global.process.platform !== 'darwin') {
      await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'End', code: 'End', windowsVirtualKeyCode: 35 })
      await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'End', code: 'End', windowsVirtualKeyCode: 35 })
      assert.equal(await evaluate("document.querySelector('#select-toggle').value"), 'SOCKS4')
    }
    await evaluate("document.querySelector('#select-toggle').value = 'HTTPS'; document.querySelector('#proxyListOptions').open = false")
    await evaluate("document.querySelector('#useProxyCheckbox').click()")
    await until("chrome.storage.local.get('useProxy').then(data => data.useProxy === false)")
    await fill({ proxyName: '<img src=x onerror=alert(1)>', proxyServerInput: `127.0.0.1:${proxy.address().port}`,
      'select-toggle': 'HTTP', proxyUsername: 'alice', proxyPassword: 'secret' })
    await evaluate("document.querySelector('#proxyForm').requestSubmit()")
    await until("document.querySelectorAll('#proxyRows tr').length === 2")
    assert.equal(await evaluate("document.querySelector('#proxyRows img') === null"), true)
    assert.equal(await evaluate("document.querySelector('#proxyRows').textContent.includes('secret')"), false)
    assert.equal(await evaluate("chrome.storage.local.get('proxies').then(data => data.proxies[0].password)"), 'secret')
    await evaluate("chrome.storage.local.get(['proxies', 'proxyChecks']).then(({proxies, proxyChecks}) => chrome.storage.local.set({proxyChecks: {...proxyChecks, [proxies[0].id]: proxyChecks['check-0']}}))")
    await until("document.querySelector('#proxyRows').textContent.includes('Available')")
    assert.equal(await evaluate("document.querySelector('#proxyFilters').open"), false)
    await evaluate("document.querySelector('#proxyFilterExit').value = 'US'; document.querySelector('#proxyFilterExit').dispatchEvent(new Event('change', {bubbles: true}))")
    assert.equal(await evaluate("document.querySelectorAll('#proxyRows tr').length"), 1)
    assert.deepEqual(await evaluate("chrome.storage.local.get('selectedProxyIds').then(data => data.selectedProxyIds)"), ['builtin'])
    await evaluate("document.querySelector('#proxyFilterServer').add(new Option('DE', 'DE')); document.querySelector('#proxyFilterServer').value = 'DE'; document.querySelector('#proxyFilterServer').dispatchEvent(new Event('change', {bubbles: true}))")
    assert.equal(await evaluate("document.querySelectorAll('#proxyRows tr').length"), 0)
    assert.equal(await evaluate("document.querySelector('#proxyNoMatches').hidden"), false)
    assert.equal(await evaluate("document.querySelector('#proxyPrevious').disabled && document.querySelector('#proxyNext').disabled && document.querySelector('#proxyRemoveFiltered').disabled"), true)
    await fill({ proxyFilterExit: '', proxyFilterServer: '' })
    if (global.process.env.CT_BROWSER_SCREENSHOT) {
      await evaluate("document.querySelector('#useProxyCheckbox').click(); document.querySelector('#proxyListOptions').open = true; document.querySelector('#proxyAuthOptions').open = true")
      await until("chrome.storage.local.get('useProxy').then(data => data.useProxy === true)")
      await command('Emulation.setDeviceMetricsOverride', { width: 1200, height: 1200, deviceScaleFactor: 1, mobile: false })
      const { data } = await command('Page.captureScreenshot', { captureBeyondViewport: true })
      await fs.writeFile(global.process.env.CT_BROWSER_SCREENSHOT, Buffer.from(data, 'base64'))
      await evaluate("document.querySelector('#useProxyCheckbox').click()")
      await until("chrome.storage.local.get('useProxy').then(data => data.useProxy === false)")
    }
    await evaluate("document.querySelectorAll('#proxyRows input')[1].click()")
    await until("chrome.storage.local.get('selectedProxyIds').then(data => data.selectedProxyIds.length === 2)")
    await until("document.querySelectorAll('#proxyRows tr')[1].querySelector('button').disabled === false")
    await evaluate("document.querySelectorAll('#proxyRows tr')[1].querySelector('button').click()")
    assert.equal(await evaluate("document.querySelector('#proxyFormTitle').textContent"), 'Edit proxy')
    assert.equal(await evaluate("document.querySelector('#select-toggle').value"), 'HTTP')
    await fill({ proxyName: 'Renamed' })
    await evaluate("document.querySelector('#proxyForm').requestSubmit()")
    await until("document.querySelector('#proxyRows').textContent.includes('Renamed')")
    assert.equal(await evaluate("document.querySelector('#proxyFormTitle').textContent"), 'Add a proxy')
    assert.equal(await evaluate("document.querySelector('#select-toggle').value"), 'HTTPS')
    assert.equal(await evaluate("document.querySelector('#proxyRows').textContent.includes('Available')"), true)
    await evaluate("document.querySelectorAll('#proxyRows tr')[1].querySelector('button').click()")
    await fill({ proxyPassword: 'changed' })
    await evaluate("document.querySelector('#proxyForm').requestSubmit()")
    await until("!document.querySelector('#proxyRows').textContent.includes('Available')")
    await evaluate("document.querySelectorAll('#proxyRows tr')[1].querySelectorAll('button')[1].click()")
    await until("document.querySelectorAll('#proxyRows tr').length === 1")
    assert.equal(await evaluate("document.querySelector('#proxyCheckStop').disabled"), true, 'List edits must not enable unrelated check controls')
    assert.equal(await evaluate("chrome.storage.local.get('useProxy').then(data => data.useProxy)"), false)
    assert.equal(await evaluate("document.querySelector('#pageError') === null"), true)
    assert.equal(await evaluate("document.querySelector('#proxyAll') === null"), true)
    await evaluate(`for (const key of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
      'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'])
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))`)
    const animationURL = await evaluate("chrome.runtime.getURL('animation.html')")
    const animationTab = (await command('Target.getTargets', {})).targetInfos
      .find(target => target.url === animationURL)
    assert.ok(animationTab, 'The sequence must open the animation in a tab')
    const { sessionId: animationSession } = await command('Target.attachToTarget', { targetId: animationTab.targetId, flatten: true })
    await command('Emulation.setDeviceMetricsOverride', { width: 1280, height: 1050, deviceScaleFactor: 1, mobile: false }, animationSession)
    await command('Page.enable', {}, animationSession)
    await command('Page.bringToFront', {}, animationSession)
    await command('Page.addScriptToEvaluateOnNewDocument', { source: `
      window.animationClock = 0;
      performance.now = () => window.animationClock;
      window.requestAnimationFrame = callback => setTimeout(() => callback(window.animationClock), 16);
      window.cancelAnimationFrame = clearTimeout;
      const fill = CanvasRenderingContext2D.prototype.fillRect;
      CanvasRenderingContext2D.prototype.fillRect = function (...args) {
        window.animationRenderedTime = window.animationClock;
        return fill.apply(this, args);
      };` }, animationSession)
    await command('Page.reload', {}, animationSession)
    await until('window.animationRenderedTime === 0', animationSession)
    assert.equal(await evaluate("document.querySelector('button, input, audio, video') === null", animationSession), true)
    let firstSample
    for (const seconds of [2, 10, 29.9, 32, 62]) {
      await evaluate(`window.animationClock = ${seconds * 1000}`, animationSession)
      await until(`window.animationRenderedTime === ${seconds * 1000}`, animationSession)
      assert.equal(await evaluate(`(() => { const canvas = document.querySelector('canvas');
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        for (let index = 0; index < pixels.length; index += 4)
          if (Math.max(...pixels.slice(index, index + 3)) - Math.min(...pixels.slice(index, index + 3)) > 40) return true;
        return false })()`, animationSession), true, `Dark areas must contain logo pixels at ${seconds}s`)
      const sample = await evaluate("document.querySelector('canvas').toDataURL()", animationSession)
      if (seconds === 2) firstSample = sample
      if (seconds === 32 || seconds === 62) assert.equal(sample, firstSample, 'The 30-second clip must keep looping')
      if (global.process.env.CT_ANIMATION_SCREENSHOTS) {
        const shot = await command('Page.captureScreenshot', {}, animationSession)
        await fs.writeFile(path.join(global.process.env.CT_ANIMATION_SCREENSHOTS, `bad-apple-${seconds}.png`), Buffer.from(shot.data, 'base64'))
      }
    }
    await evaluate(`(() => {
      const canvas = document.querySelector('canvas');
      const context = canvas.getContext('2d');
      const draw = context.drawImage;
      const fill = context.fillRect;
      context.fillRect = function (...args) {
        window.firstLogoX = null;
        return fill.apply(this, args);
      };
      const size = canvas.width / 80;
      const gap = (size - Math.round(size * 0.9)) / 2;
      window.logoSlid = false;
      context.drawImage = function (sprite, x, y) {
        if (window.firstLogoX === null) window.firstLogoX = x;
        const column = (x - gap) / size, row = (y - gap) / size;
        if (Math.abs(column - Math.round(column)) > 0.01 || Math.abs(row - Math.round(row)) > 0.01)
          window.logoSlid = true;
        return draw.call(this, sprite, x, y);
      };
      window.animationClock = 62033;
    })()`, animationSession)
    await until('window.logoSlid === true', animationSession)
    await evaluate('window.animationClock = 90000', animationSession)
    await until('window.animationRenderedTime === 90000', animationSession)
    const normalLogoX = await evaluate('window.firstLogoX', animationSession)
    await evaluate(`(() => {
      const canvas = document.querySelector('canvas'), bounds = canvas.getBoundingClientRect();
      canvas.dispatchEvent(new PointerEvent('pointermove', {
        clientX: bounds.left + bounds.width / 320, clientY: bounds.top + bounds.height / 120
      }));
    })()`, animationSession)
    for (let frame = 1; frame <= 20; frame++) {
      await evaluate('window.animationClock += 16', animationSession)
      await until(`window.animationRenderedTime === ${90000 + frame * 16}`, animationSession)
    }
    assert.ok(await evaluate('window.firstLogoX', animationSession) > normalLogoX + 5)
    await evaluate("document.querySelector('canvas').dispatchEvent(new PointerEvent('pointerleave')); window.animationClock += 16", animationSession)
    await until('window.animationRenderedTime === 90336', animationSession)
    const hoverLogoX = await evaluate('window.firstLogoX', animationSession)
    assert.ok(hoverLogoX > normalLogoX + 5, 'Hover displacement must remain after the pointer leaves')
    await evaluate("document.querySelector('canvas').dispatchEvent(new MouseEvent('click')); window.animationClock += 16", animationSession)
    await until('window.animationRenderedTime === 90352', animationSession)
    assert.ok(await evaluate('window.firstLogoX', animationSession) > hoverLogoX, 'A click must add outward velocity')
    await command('Emulation.setDeviceMetricsOverride', { width: 360, height: 740, deviceScaleFactor: 1, mobile: false }, animationSession)
    await until("document.querySelector('canvas').getBoundingClientRect().width <= 360", animationSession)
    assert.equal(await evaluate("document.documentElement.scrollWidth <= 360", animationSession), true)
    await command('Target.closeTarget', { targetId: animationTab.targetId })
    assert.equal(await evaluate("document.querySelector('#proxyImportOptions').open"), false)
    assert.equal(await evaluate("document.querySelector('#proxyAntizapretImport').textContent"), 'Import or refresh Antizapret')
    assert.equal(await evaluate("document.querySelector('#proxyCheckOptions').open"), false)
    assert.equal(await evaluate("document.querySelector('#proxyRecoveryEnabled').checked"), false)
    assert.equal(await evaluate("document.querySelector('#proxyRecoveryEnabled').getBoundingClientRect().height > 0"), true)
    await evaluate("document.querySelector('#proxyRecoveryEnabled').click()")
    await until("chrome.storage.local.get('proxyRecoveryEnabled').then(data => data.proxyRecoveryEnabled === true)")
    assert.equal(await evaluate("chrome.storage.local.get('useProxy').then(data => data.useProxy)"), false)
    await until("document.querySelector('#proxyRecoveryEnabled').disabled === false")
    await evaluate("document.querySelector('#proxyRecoveryEnabled').click()")
    await until("chrome.storage.local.get('proxyRecoveryEnabled').then(data => data.proxyRecoveryEnabled === false)")
    await fill({ proxyImportText: 'http://imported.example:8080' })
    await evaluate("document.querySelector('#proxyImportButton').click()")
    await until("document.querySelector('#proxyRows').textContent.includes('imported.example')")
    assert.deepEqual(await evaluate("chrome.storage.local.get('selectedProxyIds').then(data => data.selectedProxyIds)"), ['builtin'])
    assert.equal(await evaluate("document.querySelector('#proxySubscriptionsEnabled').checked"), false)
    await until("document.querySelector('#proxyImportButton').disabled === false")
    await fill({ proxyImportUrl: 'https://subscription.example/list' })
    await evaluate("document.querySelector('#proxySubscribeButton').click()")
    await until("document.querySelector('#proxySubscriptions').textContent.includes('subscription.example')")
    assert.equal(await evaluate("chrome.storage.local.get('useProxy').then(data => data.useProxy)"), false)
    await evaluate("chrome.runtime.sendMessage({type: 'ct-background', action: 'proxies', args: {operation: 'append', proxies: Array.from({length: 205}, (_, i) => ({id: 'bulk-' + i, name: 'Bulk ' + i, protocol: 'HTTP', host: 'bulk' + i + '.example', port: 8080}))}})")
    await evaluate("location.reload()")
    await until("document.querySelectorAll('#proxyRows tr').length === 100")
    assert.equal(await evaluate("document.querySelector('#proxyPagination').hidden"), false)
    await evaluate("document.querySelectorAll('#proxyRows input')[1].click()")
    await until("chrome.storage.local.get('selectedProxyIds').then(data => data.selectedProxyIds.length === 2)")
    await until("document.querySelector('#proxyNext').disabled === false")
    await evaluate("document.querySelector('#proxyNext').click(); document.querySelector('#proxyNext').click()")
    assert.equal(await evaluate("document.querySelectorAll('#proxyRows tr').length"), 7)
    await evaluate("window.confirm = text => { window.deletePrompt = text; return false }; document.querySelector('#proxyRemoveFiltered').click()")
    assert.equal(await evaluate("chrome.storage.local.get('proxies').then(data => data.proxies.length)"), 206)
    assert.equal(await evaluate("window.deletePrompt.includes('206')"), true)
    await evaluate("window.confirm = () => true; document.querySelector('#proxyRemoveFiltered').click()")
    await until("document.querySelectorAll('#proxyRows tr').length === 1")
    assert.deepEqual(await evaluate("chrome.storage.local.get('selectedProxyIds').then(data => data.selectedProxyIds)"), ['builtin'])
    assert.equal(await evaluate("chrome.storage.local.get('proxies').then(data => data.proxies.length)"), 0)
    const beforeEditor = await evaluate("chrome.storage.local.get(['customProxiedDomains', 'ignoredHosts'])")
    const editorText = "Array.from(document.querySelectorAll('.cm-line'), line => line.textContent).join('\\n')"
    const shortcutModifier = global.process.platform === 'darwin' ? 4 : 2
    const pressKey = async (letter, modifiers = shortcutModifier) => {
      await command('Input.dispatchKeyEvent', { type: 'keyDown', key: letter, code: `Key${letter.toUpperCase()}`,
        windowsVirtualKeyCode: letter.toUpperCase().charCodeAt(0), modifiers })
      await command('Input.dispatchKeyEvent', { type: 'keyUp', key: letter, code: `Key${letter.toUpperCase()}`,
        windowsVirtualKeyCode: letter.toUpperCase().charCodeAt(0), modifiers })
    }
    for (const [page, setting] of [['proxy-list.html', 'customProxiedDomains'], ['ignore-list.html', 'ignoredHosts']]) {
      await evaluate(`chrome.storage.local.set({${setting}: ['first.example', 'second.example']})`)
      await evaluate(`location.href = chrome.runtime.getURL('${page}')`)
      await until(`${editorText} === 'first.example\\nsecond.example'`)
      assert.equal(await evaluate("document.querySelector('#textarea').hidden"), true)
      assert.equal(await evaluate("document.querySelector('.cm-content').spellcheck"), false)
      assert.ok(await evaluate("document.querySelector('.cm-editor').getBoundingClientRect().height > 100"))
      for (const theme of ['dark', 'light']) {
        await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: theme }] })
        await until(`getComputedStyle(document.querySelector('.cm-editor')).backgroundColor === '${theme === 'dark' ? 'rgb(36, 39, 40)' : 'rgb(255, 255, 255)'}'`)
        assert.equal(await evaluate("getComputedStyle(document.querySelector('.cm-editor')).backgroundColor"),
          theme === 'dark' ? 'rgb(36, 39, 40)' : 'rgb(255, 255, 255)')
      }
      await evaluate("document.querySelector('.cm-content').focus()")
      await pressKey('a')
      await command('Input.insertText', { text: 'alpha.example\nbeta.example\nalpha.example' })
      await until(`${editorText} === 'alpha.example\\nbeta.example\\nalpha.example'`)
      await pressKey('z')
      await until(`${editorText} === 'first.example\\nsecond.example'`)
      await pressKey('Z', shortcutModifier | 8)
      await until(`${editorText} === 'alpha.example\\nbeta.example\\nalpha.example'`)
      const endKey = global.process.platform === 'darwin'
        ? { key: 'ArrowDown', code: 'ArrowDown', windowsVirtualKeyCode: 40, modifiers: 4 }
        : { key: 'End', code: 'End', windowsVirtualKeyCode: 35, modifiers: 2 }
      await command('Input.dispatchKeyEvent', { type: 'keyDown', ...endKey })
      await command('Input.dispatchKeyEvent', { type: 'keyUp', ...endKey })
      await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
      await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 })
      assert.equal(await evaluate("document.activeElement.classList.contains('cm-content')"), true,
        'Tab inserts indentation without leaving the editor')
      await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 })
      await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Backspace', code: 'Backspace', windowsVirtualKeyCode: 8 })
      await until(`${editorText} === 'alpha.example\\nbeta.example\\nalpha.example'`)
      await evaluate("document.querySelector('#search').value = 'beta.example'; document.querySelector('#search').dispatchEvent(new Event('input'))")
      assert.equal(await evaluate("document.querySelector('.cm-editor .highlight')?.textContent"), 'beta.example')
      await evaluate("document.querySelector('#search').value = ''; document.querySelector('#search').dispatchEvent(new Event('input'))")
      assert.equal(await evaluate("document.querySelectorAll('.cm-editor .highlight').length"), 0)
      await evaluate("document.querySelector('.cm-content').focus()")
      await pressKey('f')
      await until("document.querySelector('.cm-search input') === document.activeElement")
      await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 })
      await until("document.querySelector('.cm-search') === null")
      await evaluate("document.querySelector('#saveChanges').click()")
      await until(`chrome.storage.local.get('${setting}').then(data => JSON.stringify(data.${setting}) === '["alpha.example","beta.example"]')`)
      await evaluate('window.editorReloadPending = true; location.reload()')
      await until(`!window.editorReloadPending && ${editorText} === 'alpha.example\\nbeta.example'`)
      if (page === 'proxy-list.html') {
        await evaluate(`document.querySelector('#loadDomains').click();
          const transfer = new DataTransfer();
          transfer.items.add(new File(['cdn.example\\n\\nпример.рф'], 'domains.txt', {type: 'text/plain'}));
          document.querySelector('#textFileInput').files = transfer.files;
          document.querySelector('#textFileInput').dispatchEvent(new Event('change'))`)
        await until(`${editorText}.includes('cdn.example\\nxn--e1afmkfd.xn--p1ai')`)
        assert.equal(await evaluate("document.querySelector('#popup').hidden"), true)
        await evaluate("document.querySelector('#saveChanges').click()")
        await until("chrome.storage.local.get('customProxiedDomains').then(data => data.customProxiedDomains.includes('xn--e1afmkfd.xn--p1ai'))")
      }
    }
    await evaluate(`chrome.storage.local.set(${JSON.stringify(beforeEditor)})`)
    await evaluate("location.href = chrome.runtime.getURL('advanced-options.html')")
    await until("document.querySelector('#siteRuleSave')?.disabled === false")
    assert.equal(await evaluate("document.querySelector('#extendedSettings').hidden"), true)
    await evaluate(`for (const key of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown',
      'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'])
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }))`)
    await until("document.querySelector('#extendedSettings').hidden === false")
    assert.equal((await command('Target.getTargets', {})).targetInfos
      .some(target => target.url === animationURL), false)
    assert.equal(await evaluate("chrome.storage.local.get('useProxy').then(data => data.useProxy)"), false)
    await evaluate("location.reload()")
    await until("document.querySelector('#siteRuleSave')?.disabled === false")
    assert.equal(await evaluate("document.querySelector('#extendedSettings').hidden"), true)
    assert.equal(await evaluate("document.querySelector('#siteRuleOptions').open"), false)
    await checkSettingsLayout('advanced', ['siteRuleOptions'])
    await command('Page.bringToFront', {})
    await evaluate("document.querySelector('#importSettingsInput').addEventListener('click', event => { event.preventDefault(); window.importClicked = true }, {once: true}); document.querySelector('#importSettings').focus()")
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13, text: '\r' })
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 })
    assert.equal(await evaluate('window.importClicked'), true, 'Import must work from the keyboard')
    await fill({ siteRuleHost: 'ПРИМЕР.РФ', siteRuleCountries: 'ru, cn' })
    await evaluate("document.querySelector('#siteRuleForm').requestSubmit()")
    await until("document.querySelector('#siteRuleRows').textContent.includes('xn--e1afmkfd.xn--p1ai')")
    assert.deepEqual(await evaluate("chrome.storage.local.get('siteCountryRules').then(data => data.siteCountryRules['xn--e1afmkfd.xn--p1ai'])"), ['RU', 'CN'])
    assert.equal(await evaluate("chrome.storage.local.get('useProxy').then(data => data.useProxy)"), false)
    await until("document.querySelector('#siteRuleSave').disabled === false")
    await evaluate("document.querySelector('#siteRuleRows button').click()")
    await fill({ siteRuleCountries: '' })
    await evaluate("document.querySelector('#siteRuleForm').requestSubmit()")
    await until("document.querySelector('#siteRuleRows').textContent.includes('No country restriction')")
    await until("document.querySelector('#siteRuleSave').disabled === false")
    await evaluate("document.querySelectorAll('#siteRuleRows button')[1].click()")
    await until("document.querySelector('#siteRuleRows').children.length === 0")
    await evaluate('chrome.storage.local.get(null).then(data => { window.beforeForkImport = data })')
    const forkBackup = { useProxy: false, useOwnProxy: true, proxyAllTraffic: true,
      customProxies: [{ id: 'old_id', protocol: 'HTTP', uri: `127.0.0.1:${proxy.address().port}`,
        credentials: 'alice:se%63ret' }], proxyChain: ['old_id', 'builtin'],
      proxySources: [`http://registry-source.example:${origin.address().port}/registry-list`],
      proxySourcesEnabled: true, useCustomRegistry: true,
      customRegistryUrl: `http://registry-source.example:${origin.address().port}/registry-list` }
    assert.equal(await evaluate(`chrome.runtime.sendMessage({type: 'ct-background', action: 'importSettings', args: ${JSON.stringify(forkBackup)}}).then(result => result.error || 'OK')`), 'OK')
    const imported = await evaluate("chrome.storage.local.get(['proxies', 'selectedProxyIds', 'proxyAll', 'useProxy', 'registrySource', 'proxySubscriptionsEnabled', 'proxyRecoveryEnabled'])")
    assert.equal(imported.proxies[0].password, 'secret')
    assert.deepEqual(imported.selectedProxyIds, ['fork-0', 'builtin'])
    assert.equal(imported.proxyAll, true)
    assert.equal(imported.useProxy, false)
    assert.equal(imported.registrySource.enabled || imported.registrySource.autoUpdate || imported.proxySubscriptionsEnabled || imported.proxyRecoveryEnabled, false)
    assert.equal(registryHits, 0, 'A backup cannot grant consent to download its URLs')
    assert.equal(await evaluate("chrome.runtime.sendMessage({type: 'ct-background', action: 'importSettings', args: {formatVersion: 1, settings: window.beforeForkImport}}).then(result => result.error || 'OK')"), 'OK')
    await evaluate("chrome.storage.local.set({useRegistry: true, domains: ['builtin-only.example'], customProxiedDomains: ['manual.example']})")
    await evaluate("location.href = chrome.runtime.getURL('registry.html')")
    await until("document.querySelector('#registrySourceSave')?.disabled === false")
    assert.equal(await evaluate("document.querySelector('#registrySourceOptions').open"), true)
    await checkSettingsLayout('registry', ['registrySourceOptions'])
    assert.equal(await evaluate("document.querySelector('#registrySourceEnabled').checked || document.querySelector('#registrySourceAutoUpdate').checked"), false)
    await evaluate("document.querySelector('#registrySourceKind').value = 'anticensority'; document.querySelector('#registrySourceKind').dispatchEvent(new Event('change'))")
    assert.equal(await evaluate("document.querySelector('#registrySourceUrl').readOnly && document.querySelector('#registrySourceUrl').value.startsWith('https://raw.githubusercontent.com/anticensority/')"), true)
    assert.equal(registryHits, 0)
    await evaluate("document.querySelector('#registrySourceKind').value = 'custom'; document.querySelector('#registrySourceKind').dispatchEvent(new Event('change'))")
    await fill({ registrySourceUrl: `http://registry-source.example:${origin.address().port}/registry-list` })
    await evaluate("document.querySelector('#registrySourceForm').requestSubmit()")
    await until("chrome.storage.local.get('registrySource').then(data => data.registrySource?.url.includes('/registry-list'))")
    await until("document.querySelector('#registrySourceSave').disabled === false")
    assert.equal(registryHits, 0, 'Saving a source without automatic updates must not download it')
    await evaluate("document.querySelector('#registrySourceEnabled').click()")
    await evaluate("document.querySelector('#registrySourceRefresh').click()")
    await until("document.querySelector('#registrySourceStatus').textContent.includes('Cached domains: 2')")
    assert.equal(registryHits, 1)
    assert.equal(await evaluate("chrome.storage.local.get('useProxy').then(data => data.useProxy)"), false)
    await evaluate("document.querySelector('#useRegistryCheckbox').click()")
    await until("chrome.storage.local.get('useRegistry').then(data => data.useRegistry === false)")
    assert.deepEqual(await evaluate("chrome.storage.local.get('domains').then(data => data.domains)"), ['builtin-only.example'])
    assert.deepEqual(await evaluate("chrome.storage.local.get('externalRegistry').then(data => data.externalRegistry.domains)"), ['external.example', 'cdn.example.co.uk'])
    const relatedTab = await evaluate(`chrome.tabs.create({url: 'http://page.related.example:${origin.address().port}/related-page', active: true}).then(tab => tab.id)`)
    await until(`chrome.tabs.get(${relatedTab}).then(tab => tab.title === 'Related ready')`)
    await evaluate("location.href = chrome.runtime.getURL('popup.html')")
    await until("document.querySelector('#relatedDomainsScan')?.disabled === false")
    assert.equal(await evaluate("document.querySelector('#relatedDomains').open"), false)
    assert.equal(await evaluate("document.querySelector('#relatedDomainsList').children.length"), 0)
    const beforeScan = relatedHits
    await evaluate("document.querySelector('#toggleSiteActions').click(); document.querySelector('#relatedDomains').open = true; document.querySelector('#relatedDomainsScan').click()")
    await until("document.querySelector('#relatedDomainsList').children.length === 2")
    assert.equal(relatedHits, beforeScan)
    assert.equal(await evaluate("document.querySelector('#relatedDomainsAdd').disabled"), true)
    await evaluate("const input = document.querySelector('#relatedDomainsList input[value=\"cdn.related.example\"]'); input.click()")
    await evaluate("document.querySelector('#relatedDomainsAdd').click()")
    await until("document.querySelector('#relatedDomainsStatus').textContent.startsWith('Added: 1')")
    assert.equal(await evaluate("chrome.storage.local.get('customProxiedDomains').then(data => data.customProxiedDomains.includes('cdn.related.example') && !data.customProxiedDomains.includes('api.related.example'))"), true)
    assert.equal(await evaluate("chrome.storage.local.get('useProxy').then(data => data.useProxy)"), false)
    await evaluate("document.querySelector('#siteActionProxy').click(); chrome.runtime.sendMessage({type: 'ct-background', action: 'addRelatedDomains', args: ['api.related.example']})")
    await until("chrome.storage.local.get('customProxiedDomains').then(data => data.customProxiedDomains.includes('page.related.example') && data.customProxiedDomains.includes('api.related.example'))")
    await evaluate(`chrome.tabs.remove(${relatedTab})`)
    await evaluate("location.href = chrome.runtime.getURL('registry.html')")
    await until("document.querySelector('#registrySourceSave')?.disabled === false")
    await evaluate(`chrome.storage.local.set({enableExtension: true, useProxy: true, proxyAll: true,
      proxies: [{id: 'provider', name: 'Antizapret test', protocol: 'HTTP', host: '127.0.0.1', port: ${proxy.address().port}, provider: 'antizapret', restricted: true}],
      selectedProxyIds: ['provider'], ignoredHosts: ['ignored.provider.example'],
      antizapret: {domains: ['provider.example'], proxyKeys: ['HTTP 127.0.0.1:${proxy.address().port}'], updatedAt: Date.now()}})`)
    await evaluate("chrome.runtime.sendMessage({type: 'ct-background', action: 'setProxy'})")
    assert.equal(await evaluate(`fetch('http://child.provider.example:${origin.address().port}/allowed').then(response => response.text())`), 'PROXY')
    const beforeProviderBlock = directHits
    assert.equal(await evaluate(`fetch('http://outside-provider.example:${origin.address().port}/blocked').then(response => response.text(), () => 'BLOCKED')`), 'BLOCKED')
    assert.equal(directHits, beforeProviderBlock)
    assert.equal(await evaluate(`fetch('http://ignored.provider.example:${origin.address().port}/ignored').then(response => response.text())`), 'DIRECT')
    await evaluate(`chrome.storage.local.get('registrySource').then(({registrySource}) => chrome.storage.local.set({proxyAll: false, useRegistry: false,
      proxies: [{id: 'large', name: 'Large list test', protocol: 'HTTP', host: '127.0.0.1', port: ${proxy.address().port}}], selectedProxyIds: ['large'],
      externalRegistry: {source: JSON.stringify([registrySource.kind, registrySource.url]), updatedAt: Date.now(),
        domains: Array.from({length: 660000}, (_,i) => 'site' + i + '.large-registry.example')}}))`)
    await evaluate("chrome.runtime.sendMessage({type: 'ct-background', action: 'setProxy'}).then(result => {if (result.error) throw new Error(result.error); return result.value})")
    assert.equal(await evaluate(`fetch('http://site659999.large-registry.example:${origin.address().port}/large').then(response => response.text())`), 'PROXY')
    assert.equal(await evaluate(`fetch('http://unlisted.large-registry.example:${origin.address().port}/large').then(response => response.text())`), 'DIRECT')
    await evaluate("chrome.storage.local.set({externalRegistry: null}).then(() => chrome.runtime.sendMessage({type: 'ct-background', action: 'setProxy'}))")
    await evaluate('chrome.storage.local.set({enableExtension: false, useProxy: true})')
    await until("chrome.proxy.settings.get({}).then(data => data.value.mode !== 'pac_script')")
    assert.equal(await evaluate("chrome.storage.local.get('useProxy').then(data => data.useProxy)"), true,
      'A global switch change must not overwrite the saved proxy choice')
    await evaluate('chrome.storage.local.set({enableExtension: true, useProxy: true})')
    await until("chrome.proxy.settings.get({}).then(data => data.value.mode === 'pac_script')")
    await evaluate('chrome.storage.local.set({enableExtension: false, useProxy: false})')
    await until("chrome.proxy.settings.get({}).then(data => data.value.mode !== 'pac_script')")
    await evaluate('chrome.storage.local.set({enableExtension: true, useProxy: true})')
    await until("chrome.proxy.settings.get({}).then(data => data.value.mode === 'pac_script')")
    await evaluate("chrome.storage.local.remove('enableExtension')")
    await until("chrome.proxy.settings.get({}).then(data => data.value.mode !== 'pac_script')")
    let localPort = 23456
    let holdLocalPing
    const localRequests = []
    localApi = createServer((request, response) => {
      localRequests.push(request.url)
      response.setHeader('Content-Type', 'application/json')
      if (request.url.endsWith('/ping') && holdLocalPing) {
        holdLocalPing(response)
        holdLocalPing = null
        return
      }
      response.end(JSON.stringify({ status: 'ok', proxyPort: localPort }))
    })
    await new Promise((resolve, reject) => {
      localApi.once('error', reject)
      localApi.listen(49490, resolve)
    })
    await evaluate('chrome.storage.local.set({enableExtension: true, useProxy: true, showNotifications: false})')
    await evaluate("location.href = chrome.runtime.getURL('proxy-options.html')")
    await until("document.querySelectorAll('#proxyRows tr').length === 2")
    await evaluate("document.querySelector('#useLocalProxy').click()")
    await until("chrome.storage.local.get('localProxyURI').then(data => data.localProxyURI === '127.0.0.1:23456')")
    await until("chrome.proxy.settings.get({}).then(data => data.value.pacScript?.data.includes('23456'))")
    await until("document.querySelector('#localProxyStatus').textContent.includes('Connected')")
    assert.equal(await evaluate("document.querySelector('#addLocalProxyButton') === null"), true)
    localPort = 34567
    await evaluate("chrome.runtime.sendMessage({type: 'ct-background', action: 'syncLocalProxy'})")
    await until("chrome.proxy.settings.get({}).then(data => data.value.pacScript?.data.includes('34567'))")
    localPort = null
    await evaluate("chrome.runtime.sendMessage({type: 'ct-background', action: 'syncLocalProxy'})")
    await until("chrome.proxy.settings.get({}).then(data => data.value.mode !== 'pac_script')")
    await until("getComputedStyle(document.querySelector('#localProxyOptions')).display !== 'none'")
    assert.equal(await evaluate("chrome.storage.local.get('useProxy').then(data => data.useProxy)"), true)
    localPort = 34567
    await evaluate("chrome.runtime.sendMessage({type: 'ct-background', action: 'syncLocalProxy'})")
    await until("chrome.proxy.settings.get({}).then(data => data.value.pacScript?.data.includes('34567'))")
    await evaluate("document.querySelector('#useDefaultProxy').click()")
    await until("chrome.storage.local.get('useLocalProxy').then(data => data.useLocalProxy === false)")
    await until("document.querySelector('#localProxyOptions').hidden")
    await evaluate("chrome.runtime.sendMessage({type: 'ct-background', action: 'syncLocalProxy'})")
    assert.ok(localRequests.includes('/api/v1/down'))
    const localPing = new Promise(resolve => { holdLocalPing = resolve })
    await evaluate("document.querySelector('#useLocalProxy').click()")
    const pendingResponse = await within(localPing)
    await evaluate("document.querySelector('#useDefaultProxy').click()")
    pendingResponse.end(JSON.stringify({ status: 'ok', proxyPort: 23456 }))
    await until("chrome.storage.local.get('useLocalProxy').then(data => data.useLocalProxy === false)")
    await until("chrome.storage.local.get('localProxyURI').then(data => data.localProxyURI === null)")
    await until("document.querySelectorAll('#proxyRows tr').length === 2")
  } finally {
    if (socket) socket.close()
    if (process.pid && process.exitCode === null && process.signalCode === null) {
      const exited = new Promise(resolve => process.once('exit', resolve))
      process.kill('SIGTERM')
      try { await within(exited, 2000) } catch {
        process.kill('SIGKILL')
        await within(exited, 2000)
      }
    }
    for (const server of [origin, proxy, secureProxy, echo, localApi].filter(Boolean)) { server.closeAllConnections(); server.close() }
    await fs.rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  }
})
