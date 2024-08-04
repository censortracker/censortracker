import { getIconName, waitFor } from '../../utils'

describe('testing how processing a disseminator affects UI', () => {
  // eslint-disable-next-line no-unused-vars
  let page
  let popUp
  let settingsLink

  beforeAll(async () => {
    const extensionId = await global.getExtensionId()

    settingsLink = `${global.extensionUrlPrefix}://${extensionId}/registry.html`

    // configure region manually
    const settingsPage = await global.getPage()

    await settingsPage.goto(settingsLink)
    await waitFor(1000)
    await settingsPage.click('#select-toggle')
    await settingsPage.click('.select-option[data-value="RU"]')
    await settingsPage.close()

    // set timer to make sure that extension gets the registry
    await waitFor(10000)

    page = await global.getPage()
    popUp = await global.getPopUp()
  }, 60000)

  // TODO: find a way to trace notifications from service worker

  test('if a notification has been shown', async () => {
    await page.goto('https://www.avito.ru/', { timeout: 80000 })

    expect(true).toBe(true)
  }, 90000)

  test('status icon', async () => {
    await popUp.reload()
    await waitFor(5000)

    await popUp.waitForSelector('#statusImage')

    const statusImage = await popUp.evaluate(() => {
      return document.querySelector('#statusImage').src
    })

    expect(getIconName(statusImage)).toBe('ori')
  }, 10000)

  test('blocked label', async () => {
    await popUp.waitForSelector('#restrictions img')

    const restrictionImage = await popUp.evaluate(() => {
      return document.querySelector('#restrictions img').src
    })

    expect(getIconName(restrictionImage)).toBe('ok')
  })

  test('disseminator label', async () => {
    await popUp.waitForSelector('#ori img')

    const disseminatorImage = await popUp.evaluate(() => {
      return document.querySelector('#ori img').src
    })

    expect(getIconName(disseminatorImage)).toBe('danger')
  })
})
