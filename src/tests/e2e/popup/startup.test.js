import { getIconName } from '../utils'

describe('UI on start-up', () => {
  let popUp

  beforeAll(async () => {
    await global.getPage()
    popUp = await global.getPopUp()
  }, 20000)

  test('normal status icon', async () => {
    await popUp.waitForSelector('#statusImage')

    const statusImage = await popUp.evaluate(() => {
      return document.querySelector('#statusImage').src
    })

    expect(getIconName(statusImage)).toBe('normal')
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

  test('enabled', async () => {
    await popUp.waitForSelector('#footerExtensionIsOn')

    const isOn = await popUp.evaluate(() => {
      return document.querySelector('#footerExtensionIsOn').hidden === false
    })

    expect(isOn).toBe(true)
  })
})
