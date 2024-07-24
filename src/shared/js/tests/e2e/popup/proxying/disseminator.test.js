import { getIconName, waitFor } from '../../utils'

describe('testing how processing a disseminator affects UI', () => {
  let page
  let popUp

  beforeAll(async () => {
    page = await global.getPage()
    popUp = await global.getPopUp()

    // set timer to make sure that extension gets the registry
    await waitFor(10000)
  }, 60000)

  test('if a notification has been shown', async () => {
    await page.goto('https://www.avito.ru/')

    // TODO: find a way to trace notifications from service worker

    expect(true).toBe(true)
  }, 15000)

  test('status icon', async () => {
    await waitFor(1000)
    await popUp.reload()
    await waitFor(1500)

    await popUp.waitForSelector('#statusImage')

    const statusImage = await popUp.evaluate(() => {
      return document.querySelector('#statusImage').src
    })

    expect(getIconName(statusImage)).toBe('ori')
  })

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
