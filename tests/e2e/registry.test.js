import { createDriver, getGeneratedBackgroundPage } from './selenium'

describe('Test registry.js module', () => {
  let browser

  beforeAll(async () => {
    browser = await createDriver()
  })

  afterAll(async () => {
    await browser.quit()
  })

  it('test registry.js module', async () => {
    await getGeneratedBackgroundPage(browser)
    await browser.sleep(2000)
    const result = await browser.executeAsyncScript('await window.censortracker.registry.syncDatabase()')

    console.log(result)
  }, 10000)
})
