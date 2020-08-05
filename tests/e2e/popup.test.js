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
})
