import fs from 'fs'
import { Builder } from 'selenium-webdriver'
import { Options } from 'selenium-webdriver/chrome'
import util from 'util'

const asyncExec = util.promisify(require('child_process').exec)

const GENERATE_KEY_FILE_CMD = '' +
  '2>/dev/null openssl genrsa 2048 | openssl pkcs8 -topk8 -nocrypt -out key.pem &&' +
  'crx pack dist/ --output tests/e2e/selenium/extension/dist.crx -p key.pem >> /dev/null && ' +
  '2>/dev/null openssl rsa -in key.pem -pubout -outform DER | sha256sum | head -c32 | tr 0-9a-f a-p'

const getExtension = async () => {
  const { stdout: extensionId } = await asyncExec(GENERATE_KEY_FILE_CMD)

  const crxData = fs.readFileSync('./tests/e2e/selenium/extension/dist.crx')

  return {
    extension: new Buffer.from(crxData).toString('base64'),
    extensionId,
  }
}

export const createDriver = async () => {
  const options = new Options()

  const { extension, extensionId } = await getExtension()

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

  return { driver, extensionId }
}

const getExtensionURLByFilename = (id, page) => `chrome-extension://${id}/${page}`

export const getPopupFor = async ({ driver, extensionId }, url) => {
  const popupPage = getExtensionURLByFilename(extensionId, 'popup.html')

  await driver.sleep(1500)
  await driver.get(`${popupPage}?loadFor=${btoa(url)}`)
}

export const getGeneratedBackgroundPage = async ({ driver, extensionId }) => {
  await driver.get(getExtensionURLByFilename(extensionId, '_generated_background_page.html'))
}
