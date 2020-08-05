import { createDriver, getGeneratedBackgroundPage } from './selenium'

describe('Testing the proxying mechanism', () => {
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

  it.each(urls)('proxying does not work when cleaning proxy', async ({ url }) => {
    const browser = await createDriver()
    const bgPage = getGeneratedBackgroundPage()

    await browser.get(bgPage)
    await browser.executeScript('chrome.proxy.settings.clear({ scope: "regular" })')
    await browser.get(url)
    const title = await browser.getTitle()

    expect(title).toBe('Unavailable | Censor Tracker')

    await browser.quit()
  }, 30000)

  it.each(urls)('proxying works fine when PAC set', async ({ url, expectedTitle }) => {
    const browser = await createDriver()

    await browser.sleep(3500)
    await browser.get(url)
    const title = await browser.getTitle()

    expect(title).toBe(expectedTitle)

    await browser.quit()
  }, 30000)
})
