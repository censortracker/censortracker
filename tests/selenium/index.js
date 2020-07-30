import fs from 'fs'
import { Builder } from 'selenium-webdriver'
import { Options } from 'selenium-webdriver/chrome'

const createDriver = async () => {
  const crxData = fs.readFileSync('tests/bin/dist.crx')
  // eslint-disable-next-line new-cap
  const extension = new Buffer.from(crxData).toString('base64')

  const options = new Options()
  options.addExtensions(extension)

  const driver = await new Builder()
    .forBrowser('chrome')
    .setChromeOptions(options)
    .build()

  return driver
}

export default createDriver
