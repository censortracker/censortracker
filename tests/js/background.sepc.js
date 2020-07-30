import { Builder } from 'selenium-webdriver'

const chrome = require('selenium-webdriver/chrome')
const fs = require('fs')

function getEncodedExtension () {
  const stream = fs.readFileSync('tests/bin/dist.crx')

  return new Buffer.from(stream).toString('base64')
}

const options = new chrome.Options()
options.addExtensions(getEncodedExtension())


it('Some test', async () => {
  const browser = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build()

  await browser.get('https://google.com/')
  await browser.quit()
}, 15000)

