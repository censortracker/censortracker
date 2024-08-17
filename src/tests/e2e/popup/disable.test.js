import { getIconName, waitFor } from '../utils'

describe('UI on disabling', () => {
  let page
  let popUp

  beforeAll(async () => {
    page = await global.getPage()
    popUp = await global.getPopUp()

    await popUp.click('#disableExtension')
    // waitForNavigation doesn't work with popUp page,
    // so we reload popup manually (though it is done while disabling / enabling)
    await popUp.reload()
    await waitFor(5000)
  }, 20000)

  test('disabled status icon', async () => {
    await popUp.waitForSelector('#statusImage')

    const statusImage = await popUp.evaluate(() => {
      return document.querySelector('#statusImage').src
    })

    expect(getIconName(statusImage)).toBe('disabled')
  })

  test('enabled footer not visible', async () => {
    await popUp.waitForSelector('#footerExtensionIsOn')

    const isOn = await popUp.evaluate(() => {
      return document.querySelector('#footerExtensionIsOn').hidden === false
    })

    expect(isOn).toBe(false)
  })

  test('disabled UI is shown', async () => {
    await popUp.waitForSelector('#extensionIsOff')

    const isOff = await popUp.evaluate(() => {
      return document.querySelector('#extensionIsOff').hidden === false
    })

    expect(isOff).toBe(true)
  })

  test('no action button is visible', async () => {
    await popUp.waitForSelector('#toggleSiteActions')

    const areHidden = await popUp.evaluate(() => {
      return document.querySelector('#toggleSiteActions').hidden === true
    })

    await popUp.close()
    await page.close()
    expect(areHidden).toBe(true)
  })
})
