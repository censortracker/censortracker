const assert = require('node:assert/strict')
const { test } = require('node:test')
const { createServer } = require('node:http')
const fs = require('node:fs/promises')
const path = require('node:path')
const { chromium } = require('playwright-core')
const fixture = require('./visual-fixture.cjs')

test('SPA routes keep URLs, history, page state and cleanup', { timeout: 60000 }, async () => {
  const directory = require('../tasks/build-path.cjs')('chrome')
  const messages = JSON.parse(await fs.readFile(path.join(directory, '_locales/en/messages.json')))
  const server = createServer(async (request, response) => {
    const file = path.resolve(directory, '.' + new URL(request.url, 'http://localhost').pathname)
    if (!file.startsWith(directory + path.sep)) { response.writeHead(403).end(); return }
    try {
      const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }
      response.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
      response.end(await fs.readFile(file))
    } catch { response.writeHead(404).end() }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM || 'chromium',
      headless: process.env.CT_CHROMIUM_HEADLESS !== 'off', args: ['--no-sandbox'] })
    const page = await browser.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.addInitScript(fixture, { language: 'en', scenario: 'default', firefox: false, messages })
    const origin = `http://127.0.0.1:${server.address().port}`
    await page.goto(origin + '/options.html')
    await page.waitForSelector('#proxyOptionsButton')
    await page.evaluate(() => { window.routeSentinel = document })
    await page.locator('#proxyOptionsButton').click()
    await page.waitForURL('**/proxy-options.html')
    await page.waitForSelector('#proxyRows', { state: 'attached' })
    assert.equal(await page.evaluate(() => window.routeSentinel === document), true)
    assert.equal(await page.locator('#proxyOptionsButton').count(), 0)
    await page.goBack()
    await page.waitForSelector('#proxyOptionsButton')
    await page.goForward()
    await page.waitForSelector('#proxyRows', { state: 'attached' })
    assert.equal(await page.evaluate(() => window.routeSentinel === document), true)
    await page.goBack()
    await page.locator('#ignoreEditorButton').click()
    await page.waitForURL('**/ignore-list.html')
    await page.waitForFunction(() => document.querySelector('.cm-content')?.textContent.includes('ignored.example'))
    await page.locator('.cm-content').fill('draft.example')
    await page.goBack()
    await page.locator('#proxiedWebsitesButton').click()
    await page.waitForURL('**/proxy-list.html')
    await page.waitForFunction(() => document.querySelector('.cm-content')?.textContent.includes('alpha.example'))
    assert.equal(await page.locator('.cm-content').textContent(), 'alpha.examplebeta.example')
    await page.reload()
    await page.waitForSelector('.cm-content')
    assert.equal(await page.evaluate(() => !!window.routeSentinel), false)
    await page.goBack()
    await page.waitForSelector('#proxyOptionsButton')
    await page.evaluate(() => {
      const link = document.createElement('a')
      link.href = '/advanced-options.html'
      document.body.append(link)
      link.click()
      link.remove()
      const send = chrome.runtime.sendMessage
      chrome.runtime.sendMessage = message => message.action === 'setDataConsent'
        ? Promise.resolve({ error: 'Offline' }) : send(message)
      window.routeSentinel = document
    })
    await page.locator('#revokeConsent').click()
    await page.waitForSelector('#pageError')
    await page.goBack()
    await page.waitForSelector('#proxyOptionsButton')
    assert.equal(await page.locator('#pageError').count(), 0)
    assert.equal(await page.evaluate(() => window.routeSentinel === document), true)
    const opened = page.context().waitForEvent('page')
    await page.locator('#proxyOptionsButton').click({ modifiers: ['Control'] })
    const tab = await opened
    await tab.waitForURL('**/proxy-options.html')
    assert.equal(new URL(page.url()).pathname, '/options.html')
    await tab.close()
    assert.deepEqual(errors, [])
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
})
