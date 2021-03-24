import { createDriver, getGeneratedBackgroundPage, getPopupFor } from './selenium'
import { isElementExists, waitGetElement } from './selenium/utils'

describe('Testing popup of the extension', () => {
  let driver
  let extensionId
  const timeout = 35000

  beforeAll(async () => {
    ({ driver, extensionId } = await createDriver())
  }, 5000)

  afterAll(async () => {
    await driver.quit()
  })

  describe('checks that extension shows that website is ORI', () => {
    const urls = [
      { url: 'https://2ch.hk/' },
      { url: 'https://vk.com/' },
      { url: 'https://tinder.com' },
      { url: 'https://disk.yandex.ru' },
      { url: 'http://avito.ru' },
    ]

    it.each(urls)('popup contains "isOriBlock" element', async ({ url }) => {
      await getPopupFor({ driver, extensionId }, url)

      const oriBlock = await isElementExists(driver, { id: 'isOriBlock' }, 2500)
      const aboutOriButton = await waitGetElement(driver, { id: 'aboutOriButton' }, 2500)

      await aboutOriButton.click()
      const closeTextAboutOriButton = await waitGetElement(driver, { id: 'closeTextAboutOri' }, 2500)

      await closeTextAboutOriButton.click()

      expect(oriBlock).toBeTruthy()
    }, timeout)
  })

  describe('checks that extension shows that website is not ORI', () => {
    const urls = [
      { url: 'https://meduza.io/' },
      { url: 'https://netflix.com/' },
      { url: 'https://hd.kinopoisk.ru/' },
    ]

    it.each(urls)('popup contains "isNotOriBlock" element', async ({ url }) => {
      await getPopupFor({ driver, extensionId }, url)

      const notOriBlock = await isElementExists(driver, { id: 'isNotOriBlock' }, 1500)

      const aboutNotOriButton =
          await waitGetElement(driver, { id: 'btnAboutNotOri' }, 1500)

      await aboutNotOriButton.click()
      // const closeTextAboutNotOri =
      //     await waitGetElement(driver, { id: 'closeTextAboutNotOri' }, 3000)
      //
      // await closeTextAboutNotOri.click()

      expect(notOriBlock).toBeTruthy()
    }, timeout)
  })

  describe('checks that extension shows that website is in the registry of blocked websites', () => {
    const urls = [
      'https://tunnelbear.com/',
      'http://lostfilm.tv/',
      'https://rutracker.org/',
    ]

    it.each(urls)('popup contains restrictionsApplied element and do not contain restrictionsAreNotApplied', async (url) => {
      await getPopupFor({ driver, extensionId }, url)

      const restrictionsAreNotApplied =
        await isElementExists(driver, { id: 'restrictionsAreNotApplied' })

      expect(restrictionsAreNotApplied).toBeFalsy()

      const restrictionsApplied = await waitGetElement(driver, { id: 'restrictionsApplied' })

      const aboutForbiddenButton =
        await waitGetElement(driver, { id: 'btnAboutForbidden' })

      await aboutForbiddenButton.click()

      const closeAboutForbiddenButton =
        await waitGetElement(driver, { id: 'closeTextAboutForbidden' })

      await closeAboutForbiddenButton.click()

      expect(restrictionsApplied).toBeTruthy()
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
      await getPopupFor({ driver, extensionId }, 'https://jestjs.io/')

      const disableExtensionButton =
        await waitGetElement(driver, { id: 'disableExtension' }, 2500)

      await disableExtensionButton.click()

      const enableExtensionButton =
        await waitGetElement(driver, { id: 'enableExtension' }, 2500)

      await enableExtensionButton.click()

      await driver.sleep(2500)

      await driver.get(url)
      const title = await driver.getTitle()

      expect(title).toBe(expectedTitle)
    }, timeout)
  })

  // describe('Test if websites with cyclic redirects and certificate issues are ignored', () => {
  //   const urls = [
  //     {
  //       url: 'https://rutracker.org',
  //       expectedTitle: 'RuTracker.org',
  //     },
  //     {
  //       url: 'https://makuha.ru/',
  //       expectedTitle: 'Как сделать мебель своими руками, мастер-классы. Мебельный справочник. ' +
  //         'Чертежи и дизайн мебели. Модели и библиотеки PRO100.',
  //     },
  //     {
  //       url: 'http://makuha.ru/',
  //       expectedTitle: 'Privacy error',
  //     },
  //     {
  //       url: 'https://www.tunnelbear.com/',
  //       expectedTitle: 'TunnelBear: Secure VPN Service',
  //     },
  //     {
  //       url: 'http://extranjeros.inclusion.gob.es/',
  //       expectedTitle: 'PORTAL DE INMIGRACIÓN. Página de Inicio',
  //     },
  //     {
  //       url: 'http://gooodnews.ru/index.php/pozitivnoe/pictures/5667-kvokka-samoe-schastlivoe-zhivotnoe-na-svete',
  //       expectedTitle: 'Квокка: самое счастливое животное на свете',
  //     },
  //     {
  //       url: 'https://protonmail.com/',
  //       expectedTitle: 'Secure email: ProtonMail is free encrypted email.',
  //     },
  //   ]
  //
  //   it.each(urls)('websites with cyclic redirects/certificate issues are ignored', async ({ url, expectedTitle }) => {
  //     await driver.sleep(2000)
  //     await driver.get(url)
  //     const title = await driver.getTitle()
  //
  //     expect(title).toBe(expectedTitle)
  //   }, timeout)
  // })

  describe('testing if blocked websites unavailable without proxy', () => {
    const urls = [
      {
        url: 'https://rutracker.org',
        expectedTitle: 'RuTracker.org',
      },
    ]

    it.each(urls)('shows proxy_disabled.html page', async ({ url, expectedTitle }) => {
      try {
        await getGeneratedBackgroundPage({ driver, extensionId })
        await driver.sleep(1500)
        await driver.executeScript('await censortracker.proxy.removeProxy()')
        await driver.get(url)
        await driver.sleep(1500)
        const title = await driver.getTitle()

        expect(title).not.toBe(expectedTitle)
        expect(title).toBe('Proxy Disabled | Censor Tracker')
        // eslint-disable-next-line no-empty
      } catch (error) {

      }
    }, 15000)
  })
})

// TODO: Add to tests:
// tula.ru, dom.ru
// http://email.mg.buttondown.email/c/eJyNjk2KwzAUg08T72Lejx3bCy-aYXKN4ualjSF1SuIy15-0m24LAoH4hCTRTw7YqRw
// JCCAAISKQ16h_evztB3DODNg7xsbA_aYvz1rXIutf0dM95UXN0dMVJ2sS2cSTY5FulODFm1E67IxRS5xrfewNnxoaDi15z0suc9qqzu
// W6HpHa4g6viXLb9fZUNfI4BqKLbf3hrbHWtik4bjkwoBGxCbz6vDm_35yzfFd801-h_77FUaw
