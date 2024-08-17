import { waitFor } from '../utils'

describe('testing changes in settings', () => {
  let page
  let optionsLink
  let advancedOptionsLink

  beforeAll(async () => {
    const extensionId = await global.getExtensionId()

    optionsLink = `${global.extensionUrlPrefix}://${extensionId}/options.html`
    advancedOptionsLink = `${global.extensionUrlPrefix}://${extensionId}/advanced-options.html`

    page = await global.getPage()

    // set timer to make sure that extension gets the registry
    await waitFor(10000)
    await page.goto(optionsLink)
    await waitFor(5000)

    await page.click('#showNotificationsCheckbox')
    await waitFor(125)
    await page.click('#proxyOptionsButton')
    await waitFor(125)
    await page.click('#useProxyCheckbox')
    await page.goto(optionsLink)
    await waitFor(1000)
  }, 60000)

  test('notifications disabled', async () => {
    await page.waitForSelector('#showNotificationsCheckbox')

    const notificationsEnabled = await page.evaluate(() => {
      return document.querySelector('#showNotificationsCheckbox').checked
    })

    expect(notificationsEnabled).toBe(false)
  })

  test('proxy disabled', async () => {
    await page.waitForSelector('#proxyStatus')

    // TODO: fix managing level of control
    const notificationsEnabled = await page.evaluate(() => {
      return document.querySelector('#proxyStatus').textContent
    })

    expect(notificationsEnabled).toBe('Turned off')
  })

  test('restarting extension', async () => {
    await page.goto(advancedOptionsLink)
    await page.waitForSelector('#resetSettingsToDefault')
    await page.click('#resetSettingsToDefault')
    await waitFor(125)
    await page.click('#confirmReset')
    await waitFor(5000)

    await page.goto(optionsLink)
    await waitFor(3000)

    expect(true).toBe(true)
  }, 20000)

  test('notifications enabled', async () => {
    await page.waitForSelector('#showNotificationsCheckbox')

    const notificationsEnabled = await page.evaluate(() => {
      return document.querySelector('#showNotificationsCheckbox').checked
    })

    expect(notificationsEnabled).toBe(true)
  })

  // TODO: fix managing level of control
  // test('proxy enabled', async () => {
  //   await page.waitForSelector('#proxyStatus')

  //   const proxyEnabled = await page.evaluate(() => {
  //     return document.querySelector('#proxyStatus').textContent
  //   })

  //   expect(proxyEnabled).toBe('Turned on')
  // })
})
