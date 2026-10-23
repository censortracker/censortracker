const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const { createServer } = require('node:http')
const { chromium, firefox } = require('playwright-core')
const { PNG } = require('pngjs')
const fixture = require('./visual-fixture.cjs')

const [baselineRoot, currentRoot, output = '/tmp/censortracker-visual'] = process.argv.slice(2)
if (!baselineRoot || !currentRoot) throw new Error('Usage: node tests/visual.cjs BASELINE_DIST CURRENT_DIST [OUTPUT]')
const cases = [
  ['consent', 'default'], ['consent', 'error'], ['installed', 'default'], ['notifications', 'notice'],
  ['options', 'default'], ['options', 'paused'], ['options', 'warnings'], ['options', 'permission'],
  ['registry', 'default'], ['registry', 'expanded'], ['registry', 'error'],
  ['proxy-options', 'default'], ['proxy-options', 'expanded'], ['proxy-options', 'editing'], ['proxy-options', 'local'], ['proxy-options', 'error'],
  ['proxy-list', 'default'], ['proxy-list', 'import'], ['ignore-list', 'default'],
  ['advanced-options', 'default'], ['advanced-options', 'expanded'], ['advanced-options', 'reset'], ['advanced-options', 'updated'], ['advanced-options', 'error'],
  ['controlled', 'conflict'], ['controlled', 'conflicts'],
  ['popup', 'default'], ['popup', 'paused'], ['popup', 'disabled'], ['popup', 'warnings'], ['popup', 'notice'],
  ['popup', 'tor'], ['popup', 'i2p'], ['popup', 'actions'], ['popup', 'ori'], ['popup', 'restrictions'], ['popup', 'proxy'],
  ['incognito-required-popup', 'permission'], ['incognito-required-tab', 'permission'], ['animation', 'default'],
]
async function main() {
  const { default: pixelmatch } = await import('pixelmatch')
  const engine = process.env.CT_VISUAL_ENGINE || 'chromium'
  const executablePath = process.env[engine === 'firefox' ? 'FIREFOX' : 'CHROMIUM']
  assert.ok(executablePath, 'Set CHROMIUM or FIREFOX to a fixed browser binary')
  const browser = await (engine === 'firefox' ? firefox : chromium).launch({ executablePath, headless: true, args: engine === 'chromium' ? ['--no-sandbox', '--disable-gpu'] : [] })
  const platforms = (process.env.CT_VISUAL_PLATFORMS || 'chrome,firefox').split(',')
  const languages = (process.env.CT_VISUAL_LANGUAGES || 'en,ru,uk').split(',')
  const widths = (process.env.CT_VISUAL_WIDTHS || '1200,901,900,769,768,521,520').split(',').map(Number)
  const selected = process.env.CT_VISUAL_CASES?.split(',')
  const differences = [], errors = []
  let count = 0
  const jobs = []
  await fs.mkdir(output, { recursive: true })
  const version = browser.version()
  try {
    for (const platform of platforms) {
      for (const [pageName, scenario] of cases) {
        const name = pageName + '-' + scenario
        if (selected && !selected.includes(name) && !selected.includes(pageName)) continue
        if (platform === 'chrome' && (pageName.startsWith('incognito') || scenario === 'permission')) continue
        for (const language of languages) for (const theme of ['light', 'dark']) {
          const sizes = ['default', 'expanded'].includes(scenario) ? widths : [widths[0]]
          for (const width of pageName === 'popup' || pageName === 'incognito-required-popup' ? [315] : sizes) {
            jobs.push(async () => {
            const key = `${engine}-${platform}-${name}-${language}-${theme}-${width}`
            const screenshots = []
            const titles = []
            for (const [label, root] of [['before', baselineRoot], ['after', currentRoot]]) {
              const build = process.env.CT_VISUAL_BUILD || 'prod'
              const legacy = path.resolve(root, platform, build)
              const directory = require('node:fs').existsSync(legacy) ? legacy
                : require('../tasks/build-path.cjs')(platform, build, root)
              const server = createServer(async (req, res) => {
                const relative = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).slice(1)
                const file = path.resolve(directory, relative)
                if (!file.startsWith(directory + path.sep)) { res.writeHead(403).end(); return }
                try {
                  const types = { '.js': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' }
                  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream')
                  res.end(await fs.readFile(file))
                } catch { res.writeHead(404).end() }
              })
              await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
              const origin = `http://127.0.0.1:${server.address().port}`
              const context = await browser.newContext({ viewport: { width, height: 1050 }, colorScheme: theme, reducedMotion: 'reduce', locale: language, timezoneId: 'UTC' })
              const page = await context.newPage()
              page.on('pageerror', error => errors.push({ key, label, error: error.message }))
              try {
                await page.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort())
                const messages = JSON.parse(await fs.readFile(path.join(directory, '_locales', language, 'messages.json')))
                await page.addInitScript(fixture, { language, scenario, firefox: platform === 'firefox', messages })
                await page.goto(`${origin}/${pageName}.html`)
                await page.waitForFunction(() => document.body.children.length > 0)
                await page.evaluate(() => document.fonts.ready)
                await page.waitForTimeout(200)
                if (scenario === 'expanded') {
                  await page.locator('details').evaluateAll(nodes => nodes.forEach(node => { node.open = true }))
                  if (pageName === 'registry') await page.locator('#select-toggle').click()
                  if (pageName === 'advanced-options') {
                    for (const key of ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a']) await page.keyboard.press(key)
                    await page.locator('#showDebugInfo').click()
                  }
                }
                if (scenario === 'editing') {
                  await page.locator('#proxyListOptions').evaluate(node => { node.open = true })
                  await page.locator('#proxyRows tr').nth(1).locator('button').first().click()
                  await page.locator('#proxyAuthOptions').evaluate(node => { node.open = true })
                }
                if (scenario === 'import') await page.locator('#loadDomains').click()
                if (scenario === 'reset') await page.locator('#resetSettingsToDefault').click()
                if (scenario === 'updated') await page.locator('#updateLocalRegistry').click()
                if (scenario === 'actions') await page.locator('#toggleSiteActions').click()
                if (['ori', 'restrictions', 'proxy'].includes(scenario)) {
                  const block = scenario === 'proxy' ? 'proxying-info' : scenario
                  await page.locator(`#${block} [class*="btn-what-this-mean"], #${block} [class*="btn-about"]`).first().click()
                }
                if (scenario === 'error') {
                  const id = { consent: 'acceptConsent', registry: 'registrySourceRefresh', 'advanced-options': 'updateLocalRegistry', 'proxy-options': 'proxyImportButton' }[pageName]
                  if (pageName === 'proxy-options') await page.locator('details').evaluateAll(nodes => nodes.forEach(node => { node.open = true }))
                  await page.locator('#' + id).click()
                }
                await page.mouse.move(0, 0)
                await page.waitForTimeout(150)
                await page.evaluate(() => window.scrollTo(0, 0))
                if (pageName === 'animation') await page.waitForFunction(() => {
                  const canvas = document.querySelector('canvas')
                  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
                  return pixels.some((value, index) => index % 4 === 0 && pixels[index + 3] && value !== pixels[index + 2])
                }, null, { polling: 50 })
                const file = path.join(output, key + '-' + label + '.png')
                titles.push(await page.title())
                screenshots.push(PNG.sync.read(await page.screenshot({ path: file, fullPage: true, animations: 'disabled' })))
              } finally { await context.close(); await new Promise(resolve => server.close(resolve)) }
            }
            const [before, after] = screenshots
            assert.equal(titles[1], titles[0], key + ': document title')
            let pixels = -1
            if (before.width === after.width && before.height === after.height) {
              const diff = new PNG({ width: before.width, height: before.height })
              pixels = pixelmatch(before.data, after.data, diff.data, before.width, before.height, { threshold: 0.1 })
              if (pixels) await fs.writeFile(path.join(output, key + '-diff.png'), PNG.sync.write(diff))
            }
            if (pixels) differences.push({ key, pixels, before: [before.width, before.height], after: [after.width, after.height] })
            count++
            if (count % 20 === 0) console.log(`${count} comparisons, ${differences.length} differences, ${errors.length} errors`)
            })
          }
        }
      }
    }
    await Promise.all(Array.from({ length: Number(process.env.CT_VISUAL_WORKERS || 4) }, async () => {
      while (jobs.length) await jobs.shift()()
    }))
  } finally {
    await browser.close()
    await fs.writeFile(path.join(output, 'report.json'), JSON.stringify({ engine, version, count, differences, errors }, null, 2))
  }
  assert.equal(errors.length, 0, JSON.stringify(errors))
  assert.equal(differences.length, 0, `Visual differences: ${differences.length}; see ${output}/report.json`)
}
main().catch(error => { console.error(error); process.exitCode = 1 })
