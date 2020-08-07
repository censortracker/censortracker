import { createDriver, getPopupFor } from './selenium'
import { isElementExists, waitGetElement } from './selenium/utils'

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

      const oriBlock = await isElementExists(browser, { id: 'isOriBlock' }, 2000)

      expect(oriBlock).toBeTruthy()
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

      const isOri = await waitGetElement(browser, { id: 'isOriBlock' })
      const isNotOri = await waitGetElement(browser, { id: 'isNotOriBlock' })
      const isForbidden = await waitGetElement(browser, { id: 'isForbidden' })
      const isNotForbidden = await waitGetElement(browser, { id: 'isNotForbidden' })

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
        await waitGetElement(browser, { id: 'disableExtension' }, 1500)

      await disableExtensionButton.click()

      await browser.get(url)

      let title = await browser.getTitle()

      expect(title).not.toBe(expectedTitle)

      await getPopupFor(browser, 'https://jestjs.io/')

      const enableExtensionButton =
        await waitGetElement(browser, { id: 'enableExtension' }, 1500)

      await enableExtensionButton.click()

      await browser.sleep(1500)

      await browser.get(url)
      title = await browser.getTitle()
      expect(title).toBe(expectedTitle)
    }, timeout)
  })
})
