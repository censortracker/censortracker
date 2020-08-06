import { until } from 'selenium-webdriver'

import { createDriver, getPopupFor } from './selenium'
import { isElementExists } from './selenium/utils'

describe('Testing popup of the extension', () => {
  let browser
  const timeout = 35000
  const beforeRequestTimeout = 2000

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
      await getPopupFor(browser, url)
      const oriBlock = await browser.findElement({ id: 'isOriBlock' })

      expect(oriBlock).not.toBeUndefined()
    }, timeout)
  })

  describe('checks that extension shows that website is in the registry of blocked websites', () => {
    const urls = [
      'https://tunnelbear.com/',
      'http://lostfilm.tv/',
      'https://rutracker.org/',
    ]

    it.each(urls)('popup contains isForbidden element and do not contain isNotForbidden', async (url) => {
      await getPopupFor(browser, url)

      const isOri = await isElementExists(browser, { id: 'isOriBlock' })
      const isNotOri = await isElementExists(browser, { id: 'isNotOriBlock' })
      const isForbidden = await isElementExists(browser, { id: 'isForbidden' })
      const isNotForbidden = await isElementExists(browser, { id: 'isNotForbidden' })

      expect(isOri).toBeFalsy()
      expect(isNotOri).toBeTruthy()

      expect(isForbidden).toBeTruthy()
      expect(isNotForbidden).toBeFalsy()
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
      await getPopupFor(browser, 'https://jestjs.io/')

      const disableExtensionButton =
        await browser.wait(until.elementLocated({ id: 'disableExtension' }, 3000))
      const disableExtensionButtonIsVisible =
        await browser.wait(until.elementIsVisible(disableExtensionButton), 1500)

      expect(disableExtensionButtonIsVisible).toBeTruthy()
      await disableExtensionButton.click()

      await browser.get(url)
      let websiteTitle = await browser.getTitle()

      expect(websiteTitle).not.toBe(expectedTitle)

      await getPopupFor(browser, 'https://jestjs.io/')

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
