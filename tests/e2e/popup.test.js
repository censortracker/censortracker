import { createDriver, getPageByFilename } from './selenium'

describe('Testing popup', () => {
  const timeout = 35000
  const beforeRequestTimeout = 2000
  const popupPage = getPageByFilename('popup.html')

  describe('Test popup for ORI websites', () => {
    const urls = [
      'https://2ch.hk/',
      'https://vk.com/',
      'https://tinder.com',
      'https://disk.yandex.ru',
    ]

    it.each(urls)('popup should contain isOriBlock element ', async (url) => {
      const browser = await createDriver()
      const encodedURL = window.btoa(url)

      await browser.sleep(beforeRequestTimeout)
      await browser.get(`${popupPage}?loadFor=${encodedURL}`)
      const oriBlock = await browser.findElement({ id: 'isOriBlock' })

      expect(oriBlock).not.toBeUndefined()

      await browser.quit()
    }, timeout)
  })

  describe('Test popup for blocked websites', () => {
    const urls = [
      'https://rutracker.org/',
      'tunnelbear.com/',
      'http://lostfilm.tv/',
    ]

    it.each(urls)('popup should contain isForbidden element ', async (url) => {
      const browser = await createDriver()
      const encodedURL = window.btoa(url)

      await browser.sleep(beforeRequestTimeout)
      await browser.get(`${popupPage}?loadFor=${encodedURL}`)
      const isForbidden = await browser.findElement({ id: 'isForbidden' })

      expect(isForbidden).not.toBeUndefined()

      try {
        await browser.findElement({ id: 'isNotForbidden' })
      } catch (error) {
        expect(error).not.toBeUndefined()
      }

      await browser.quit()
    }, timeout)
  })
})
