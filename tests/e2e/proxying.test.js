import { createDriver, getGeneratedBackgroundPage } from './selenium'

describe('Testing the proxying mechanism', () => {
  let browser

  beforeAll(async () => {
    browser = await createDriver()
  })

  afterAll(async () => {
    await browser.quit()
  })

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

  it.each(urls)('proxying doesn\'t work for locked websites when cleaning proxy', async ({ url }) => {
    await browser.get(getGeneratedBackgroundPage())
    await browser.executeScript('chrome.proxy.settings.clear({ scope: "regular" })')
    await browser.sleep(1500)
    await browser.get(url)
    const title = await browser.getTitle()

    expect(title).toBe('Unavailable | Censor Tracker')
  }, 30000)

  it.each(urls)('proxying works fine when PAC set', async ({ url, expectedTitle }) => {
    await browser.sleep(2500)
    await browser.get(url)
    const title = await browser.getTitle()

    expect(title).toBe(expectedTitle)
  }, 30000)
})
