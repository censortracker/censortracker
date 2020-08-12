import fs from 'fs'
import { Builder } from 'selenium-webdriver'
import { Options } from 'selenium-webdriver/chrome'

const getExtension = () => {
  const crxData = fs.readFileSync('./tests/e2e/selenium/extension/dist.crx')

  return new Buffer.from(crxData).toString('base64')
}

export const createDriver = async () => {
  const options = new Options()

  options.addExtensions(getExtension())
  options.windowSize({
    width: 200,
    height: 200,
  })

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build()

  driver
    .manage()
    .window()
    .minimize()

  return driver
}

const getExtensionURLByFilename = (page) => {
  return `chrome-extension://kdlhnjelkjadlbccbiecdbiikllklbjo/${page}`
}

export const getPopupFor = async (browser, url) => {
  const popupPage = getExtensionURLByFilename('popup.html')

  await browser.get(`${popupPage}?loadFor=${btoa(url)}`)
}

export const getGeneratedBackgroundPage = async (browser) => {
  await browser.get(getExtensionURLByFilename('_generated_background_page.html'))
}
