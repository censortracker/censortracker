import createDriver from '../selenium'


describe('Testing the proxying mechanism', () => {

  describe('check if proxying do not work without a timeout for proxy setting up', () => {
    const blockedWebsites = [
      {
        url: 'https://rutracker.org',
        expectedTitle: 'Unavailable | Censor Tracker',
      },
    ]

    it.each(blockedWebsites)
    ('blocked sites should not open', async ({ url, expectedTitle }) => {
      const browser = await createDriver()

      await browser.get(url)
      const title = await browser.getTitle()

      expect(title).toBe(expectedTitle)
      await browser.quit()
    }, 30000)
  })

  describe('check if proxying works', () => {
    const blockedWebsites = [
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

    it.each(blockedWebsites)
    ('blocked sites should proxied without problems', async ({ url, expectedTitle }) => {
      const browser = await createDriver()

      await browser.sleep(2200)
      await browser.get(url)
      const title = await browser.getTitle()

      expect(title).toBe(expectedTitle)

      await browser.quit()

    }, 30000)
  })

});


