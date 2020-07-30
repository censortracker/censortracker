import { Builder } from 'selenium-webdriver'

const chrome = require('selenium-webdriver/chrome')
const fs = require('fs')

const buildDriver = async () => {
  const crxData = fs.readFileSync('tests/bin/dist.crx')
  // eslint-disable-next-line new-cap
  const extension = new Buffer.from(crxData).toString('base64')

  const options = new chrome.Options()
  options.addExtensions(extension)

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build()

  return driver
}

export default buildDriver
