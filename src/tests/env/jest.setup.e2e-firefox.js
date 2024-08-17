import path from 'path'
import puppeteer from 'puppeteer'

const EXTENSION_PATH = path.resolve(__dirname, '../../../dist/chrome/prod')

let browser

global.extensionUrlPrefix = 'moz-extension'

beforeAll(async () => {
  browser = await puppeteer.launch({
    headless: true,
    protocol: 'webDriverBiDi',
    product: 'firefox',
    args: [
      `--disable-extensions-except=${EXTENSION_PATH}`,
      `--load-extension=${EXTENSION_PATH}`,
    ],
  })
})

afterAll(async () => {
  if (browser) {
    await browser.close()
  }
  browser = undefined
})

global.getPage = async () => {
  const page = await browser.newPage()

  await page.bringToFront()
  return page
}

global.getPopUp = async () => {
  const workerTarget = await browser.waitForTarget(
    (target) =>
      target.type() === 'browser' && target.url().endsWith('background.js'),
  )

  const worker = await workerTarget.worker()

  await worker.evaluate('browser.action.openPopup();')

  const popupTarget = await browser.waitForTarget(
    (target) => target.type() === 'page' && target.url().endsWith('popup.html'),
  )

  const popupPage = await popupTarget.asPage()

  return popupPage
}
