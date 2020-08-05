import { until } from 'selenium-webdriver'

import { createDriver, getPopupPage } from './selenium'

describe('Testing popup of the extension', () => {
  let browser
  const timeout = 35000
  const beforeRequestTimeout = 2000
  const popupPage = getPopupPage()

  beforeAll(async () => {
    browser = await createDriver()
  })

  afterAll(async () => {
    await browser.quit()
  })

  describe('checks that extension shows that website is ORI', () => {
    const urls = [
      'https://2ch.hk/',
      'https://vk.com/',
      'https://tinder.com',
      'https://disk.yandex.ru',
    ]

    it.each(urls)('popup contains isOriBlock element ', async (url) => {
      await browser.sleep(beforeRequestTimeout)
      await browser.get(`${popupPage}?loadFor=${btoa(url)}`)
      const oriBlock = await browser.findElement({ id: 'isOriBlock' })

      expect(oriBlock).not.toBeUndefined()
    }, timeout)
  })

  describe('checks that extension shows that website is in the registry of blocked websites', () => {
    const urls = [
      'tunnelbear.com/',
      'http://lostfilm.tv/',
      'https://rutracker.org/',
    ]

    it.each(urls)('popup contains isForbidden element and do not contain isNotForbidden', async (url) => {
      await browser.sleep(beforeRequestTimeout)
      await browser.get(`${popupPage}?loadFor=${btoa(url)}`)
      const isForbidden = await browser.findElement({ id: 'isForbidden' })

      expect(isForbidden).not.toBeUndefined()
    }, timeout)
  })

  describe('Test extension after clicking on disable/enable buttons in popup', () => {
    const urls = [
      {
        url: 'https://rutracker.org',
        expectedTitle: 'RuTracker.org',
      },
      {
        url: 'https://www.tunnelbear.com/',
        expectedTitle: 'TunnelBear: Secure VPN Service',
      },
      {
        url: 'https://protonmail.com/',
        expectedTitle: 'Secure email: ProtonMail is free encrypted email.',
      },
    ]

    it.each(urls)('disable/enable buttons work fine', async ({ url, expectedTitle }) => {
      await browser.sleep(beforeRequestTimeout)
      await browser.get(`${popupPage}?loadFor=${btoa('https://jestjs.io/')}`)

      const disableExtensionButton =
        await browser.wait(until.elementLocated({ id: 'disableExtension' }, 3000))
      const disableExtensionButtonIsVisible =
        await browser.wait(until.elementIsVisible(disableExtensionButton), 1500)

      expect(disableExtensionButtonIsVisible).toBeTruthy()
      await disableExtensionButton.click()

      await browser.get(url)
      let websiteTitle = await browser.getTitle()

      expect(websiteTitle).not.toBe(expectedTitle)

      await browser.get(`${popupPage}?loadFor=${btoa('https://jestjs.io/')}`)

      const enableExtensionButton =
        await browser.wait(until.elementLocated({ id: 'enableExtension' }, 3000))
      const enableExtensionButtonIsVisible =
        await browser.wait(until.elementIsVisible(enableExtensionButton), 1500)

      await enableExtensionButtonIsVisible.click()
      await browser.sleep(1500)

      await browser.get(url)
      websiteTitle = await browser.getTitle()
      expect(websiteTitle).toBe(expectedTitle)
    }, timeout)
  })
})
