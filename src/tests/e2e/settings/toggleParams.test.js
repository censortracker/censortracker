import { waitFor } from '../utils'

const optionsLink = `${global.extensionUrlPrefix}://${global.extensionId}/options.html`
const advancedOptionsLink = `${global.extensionUrlPrefix}://${global.extensionId}/advanced-options.html`

describe('testing changes in settings', () => {
  let page

  beforeAll(async () => {
    page = await global.getPage()

    // set timer to make sure that extension gets the registry
    await waitFor(10000)
    await page.goto(optionsLink)

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

    expect(notificationsEnabled).toBe('Выключен')
  })

  test('restarting extension', async () => {
    await page.goto(advancedOptionsLink)
    await page.waitForSelector('#resetSettingsToDefault')
    await page.click('#resetSettingsToDefault')
    await waitFor(125)
    await page.click('#confirmReset')
    await waitFor(5000)

    await page.goto(optionsLink)
    await waitFor(1000)

    expect(true).toBe(true)
  }, 20000)

  test('notifications enabled', async () => {
    await page.waitForSelector('#showNotificationsCheckbox')

    const notificationsEnabled = await page.evaluate(() => {
      return document.querySelector('#showNotificationsCheckbox').checked
    })

    expect(notificationsEnabled).toBe(true)
  })

  test('proxy enabled', async () => {
    await page.waitForSelector('#proxyStatus')

    // TODO: fix managing level of control
    const notificationsEnabled = await page.evaluate(() => {
      return document.querySelector('#proxyStatus').textContent
    })

    expect(notificationsEnabled).toBe('Включен')
  })
})
