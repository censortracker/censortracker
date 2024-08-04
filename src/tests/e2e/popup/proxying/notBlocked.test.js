import { getIconName, waitFor } from '../../utils'

describe('testing how processing not blocked hostname affects UI', () => {
  let page
  let popUp

  beforeAll(async () => {
    page = await global.getPage()
    popUp = await global.getPopUp()
    await page.goto('https://example.com')
    await popUp.reload()
    await waitFor(5000)
  }, 30000)

  test('proxying rules set to auto', async () => {
    await popUp.waitForSelector('#siteActionAuto')

    const proxyingRulesAuto = await popUp.evaluate(() => {
      return document.querySelector('#siteActionAuto').checked
    })

    expect(proxyingRulesAuto).toBe(true)
  })

  test('not blocked', async () => {
    await popUp.waitForSelector('#restrictions img')

    const restrictionImage = await popUp.evaluate(() => {
      return document.querySelector('#restrictions img').src
    })

    expect(getIconName(restrictionImage)).toBe('ok')
  })

  test('not a disseminator', async () => {
    await popUp.waitForSelector('#ori img')

    const disseminatorImage = await popUp.evaluate(() => {
      return document.querySelector('#ori img').src
    })

    expect(getIconName(disseminatorImage)).toBe('ok')
  })
})
