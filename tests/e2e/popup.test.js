import { createDriver, getPopupFor } from './selenium'
import { isElementExists, waitGetElement } from './selenium/utils'

describe('Testing popup of the extension', () => {
  let browser
  const timeout = 35000

  beforeAll(async () => {
    browser = await createDriver()
  })

  afterAll(async () => {
    await browser.quit()
  })

  describe('checks that extension shows that website is or is not ORI', () => {
    const urls = [
      { url: 'https://meduza.io/', isORI: false },
      { url: 'https://2ch.hk/', isORI: true },
      { url: 'https://netflix.com/', isORI: false },
      { url: 'https://vk.com/', isORI: true },
      { url: 'https://tinder.com', isORI: true },
      { url: 'https://hd.kinopoisk.ru/', isORI: false },
      { url: 'https://disk.yandex.ru', isORI: true },
      { url: 'http://avito.ru', isORI: true },
    ]

    it.each(urls)('popup do/do not contains isOriBlock element ', async ({ url, isORI }) => {
      await getPopupFor(browser, url)

      const oriBlock =
        await isElementExists(browser, { id: 'isOriBlock' }, 2000)
      const notOriBlock =
        await isElementExists(browser, { id: 'isNotOriBlock' }, 2000)

      if (isORI) {
        const aboutOriButton =
          await waitGetElement(browser, { id: 'btnAboutOri' }, 2000)

        await aboutOriButton.click()
        const closeTextAboutOriButton =
          await waitGetElement(browser, { id: 'closeTextAboutOri' }, 1500)

        await closeTextAboutOriButton.click()

        expect(oriBlock).toBeTruthy()
        expect(notOriBlock).toBeFalsy()
      } else {
        const aboutNotOriButton =
          await waitGetElement(browser, { id: 'btnAboutNotOri' }, 2000)

        await aboutNotOriButton.click()
        const closeTextAboutNotOriButton =
          await waitGetElement(browser, { id: 'closeTextAboutNotOri' }, 1500)

        await closeTextAboutNotOriButton.click()

        expect(oriBlock).toBeFalsy()
        expect(notOriBlock).toBeTruthy()
      }
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

      const isNotForbidden =
        await isElementExists(browser, { id: 'isNotForbidden' })

      expect(isNotForbidden).toBeFalsy()

      const isForbidden = await waitGetElement(browser, { id: 'isForbidden' })

      const aboutForbiddenButton =
        await waitGetElement(browser, { id: 'btnAboutForbidden' })

      await aboutForbiddenButton.click()

      const closeAboutForbiddenButton =
        await waitGetElement(browser, { id: 'closeTextAboutForbidden' })

      await closeAboutForbiddenButton.click()

      expect(isForbidden).toBeTruthy()
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
