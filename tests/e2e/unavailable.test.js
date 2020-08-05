import {
  createDriver,
  getGeneratedBackgroundPage,
} from './selenium'

describe('Testing unavailable websites without proxy', () => {
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

  it.each(urls)('shows unavailable.html page', async ({ url, expectedTitle }) => {
    await browser.get(getGeneratedBackgroundPage())
    await browser.executeScript('chrome.proxy.settings.clear({ scope: "regular" })')
    await browser.get(url)
    await browser.sleep(1500)
    const title = await browser.getTitle()

    expect(title).not.toBe(expectedTitle)
  }, 10000)
})
