import { getIconName, waitFor } from '../../utils'

describe('testing how processing blocked hostname affects UI', () => {
  let page
  let popUp
  let settingsLink

  beforeAll(async () => {
    // configure region manually
    const extensionId = await global.getExtensionId()

    settingsLink = `${global.extensionUrlPrefix}://${extensionId}/registry.html`

    const settingsPage = await global.getPage()

    await settingsPage.goto(settingsLink)
    await waitFor(3000)
    await settingsPage.click('#select-toggle')
    await settingsPage.click('.select-option[data-value="RU"]')
    await settingsPage.close()

    // set timer to make sure that extension gets the registry
    await waitFor(15000)

    page = await global.getPage()
    try {
      await page.goto('https://bbc.com', { timeout: 60000 })
    } catch (error) {
      console.log(error)
    }
    await waitFor(1000)
    popUp = await global.getPopUp()
    await popUp.reload()
    await waitFor(5000)
  }, 80000)

  test('status icon', async () => {
    await popUp.waitForSelector('#statusImage')

    const statusImage = await popUp.evaluate(() => {
      return document.querySelector('#statusImage').src
    })

    expect(getIconName(statusImage)).toBe('blocked')
  })

  test('proxying rules', async () => {
    popUp.waitForSelector('#siteActionProxy')

    const proxyingRulesAlways = await popUp.evaluate(() => {
      return document.querySelector('#siteActionProxy').checked
    })

    expect(proxyingRulesAlways).toBe(true)
  })

  test('blocked label', async () => {
    await popUp.waitForSelector('#restrictions img')

    const restrictionImage = await popUp.evaluate(() => {
      return document.querySelector('#restrictions img').src
    })

    expect(getIconName(restrictionImage)).toBe('info')
  })

  test('not a disseminator', async () => {
    await popUp.waitForSelector('#ori img')

    const disseminatorImage = await popUp.evaluate(() => {
      return document.querySelector('#ori img').src
    })

    expect(getIconName(disseminatorImage)).toBe('ok')
  })
})
