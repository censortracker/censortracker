import fs from 'fs'
import { Builder } from 'selenium-webdriver'
import { Options } from 'selenium-webdriver/chrome'

export const createDriver = async () => {
  const crxData = fs.readFileSync('./tests/e2e/selenium/extension/dist.crx')
  const extension = new Buffer.from(crxData).toString('base64')
  const options = new Options()

  options.addExtensions(extension)
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

const getPageByFilename = (page) => {
  return `chrome-extension://kdlhnjelkjadlbccbiecdbiikllklbjo/${page}`
}

export const getPopupPage = () => {
  return getPageByFilename('popup.html')
}

export const getProxyUnavailablePage = () => {
  return getPageByFilename('proxy_unavailable.html')
}

export const getUnavailablePage = () => {
  return getPageByFilename('unavailable.html')
}

export const getGeneratedBackgroundPage = () => {
  return getPageByFilename('_generated_background_page.html')
}
