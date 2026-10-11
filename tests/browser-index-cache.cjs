const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createServer } = require('node:http')
const { spawn } = require('node:child_process')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const buildFixture = require('./build-fixture.cjs')

for (const firefox of [false, true]) {
  test(`${firefox ? 'Firefox' : 'Chrome'} restores a large index after extension reload`, { timeout: 60000 }, async context => {
    const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'ct-index-cache-'))
    const addon = path.join(temporary, 'addon')
    const profile = path.join(temporary, 'profile')
    await Promise.all([addon, profile].map(directory => fs.mkdir(directory)))
    let report
    const server = createServer((request, response) => {
      response.setHeader('Access-Control-Allow-Origin', '*')
      report(JSON.parse(new URL(request.url, 'http://localhost').searchParams.get('data')))
      response.end('OK')
    })
    let child, remote, timer
    try {
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
      await buildFixture(path.join(__dirname, 'index-cache-fixture.js'), addon)
      await fs.writeFile(path.join(addon, 'manifest.json'), JSON.stringify({
        manifest_version: firefox ? 2 : 3, name: 'Index cache test', version: '1',
        homepage_url: `http://127.0.0.1:${server.address().port}/`,
        background: firefox ? { scripts: ['background.js'] } : { service_worker: 'background.js' },
        permissions: ['storage', 'unlimitedStorage', ...(firefox ? ['http://127.0.0.1/*'] : [])],
        ...(firefox ? { browser_specific_settings: { gecko: { id: 'index-cache@censortracker.invalid' } } }
          : { host_permissions: ['http://127.0.0.1/*'] }),
      }))
      const result = new Promise(resolve => { report = resolve })
      let port
      if (firefox) {
        await fs.writeFile(path.join(profile, 'user.js'), [
          'user_pref("devtools.debugger.remote-enabled", true);',
          'user_pref("devtools.chrome.enabled", true);',
          'user_pref("devtools.debugger.prompt-connection", false);',
          'user_pref("datareporting.policy.dataSubmissionEnabled", false);',
        ].join('\n'))
        const { findFreeTcpPort } = await import('../node_modules/web-ext/lib/firefox/remote.js')
        port = await findFreeTcpPort()
      }
      child = spawn(firefox ? process.env.FIREFOX || 'firefox' : process.env.CHROMIUM || 'chromium', firefox
        ? ['--headless', '--no-remote', '--profile', profile, '--start-debugger-server', String(port), 'about:blank']
        : [`--headless=${process.env.CT_CHROMIUM_HEADLESS || 'new'}`, '--remote-debugging-port=0',
          '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage',
          '--disable-background-networking', '--disable-component-update', `--user-data-dir=${profile}`,
          `--disable-extensions-except=${addon}`, `--load-extension=${addon}`, 'about:blank'],
      { stdio: 'ignore', env: { ...process.env, MOZ_DISABLE_CONTENT_SANDBOX: '1' } })
      const failure = new Promise((resolve, reject) => {
        child.on('error', reject)
        child.on('exit', () => reject(new Error('Browser exited early')))
        timer = setTimeout(() => reject(new Error('Index cache test timed out')), 45000)
      })
      const run = async () => {
        if (firefox) {
          const { connectWithMaxRetries } = await import('../node_modules/web-ext/lib/firefox/remote.js')
          remote = await connectWithMaxRetries({ port, maxRetries: 50, retryInterval: 100 })
          await remote.installTemporaryAddon(addon)
        }
        return result
      }
      const data = await Promise.race([run(), failure])
      assert.equal(data.error, undefined, data.error)
      context.diagnostic(JSON.stringify(data))
    } finally {
      clearTimeout(timer)
      remote?.disconnect()
      if (child && child.exitCode === null && child.signalCode === null) {
        child.kill('SIGKILL')
        await new Promise(resolve => child.once('exit', resolve))
      }
      server.closeAllConnections()
      server.close()
      await fs.rm(temporary, { recursive: true, force: true, maxRetries: 3 })
    }
  })
}
