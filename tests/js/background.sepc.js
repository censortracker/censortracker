import { Builder } from 'selenium-webdriver'

const chrome = require('selenium-webdriver/chrome')
const fs = require('fs')

// TODO: Use path
const extensionCrxFile = '/Users/likid_geimfari/Developer/censortracker/tests/bin/dist.crx'

function encode (file) {
  const stream = fs.readFileSync(file)

  return new Buffer.from(stream).toString('base64')
}

const options = new chrome.Options()
options.addExtensions(encode(extensionCrxFile))


it('Some test', async () => {
  const browser = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build()

  await browser.get('https://google.com/')
  await browser.quit()
}, 15000)

