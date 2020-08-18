import {
  createDriver,
  getGeneratedBackgroundPage,
} from './selenium'

describe('Testing unavailable websites without proxy', () => {
  let browserSession

  beforeAll(async () => {
    browserSession = await createDriver()
  })

  afterAll(async () => {
    await browserSession.driver.quit()
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
    await getGeneratedBackgroundPage(browserSession)
    await browserSession.driver.executeScript('chrome.proxy.settings.clear({ scope: "regular" })')
    await browserSession.driver.get(url)
    await browserSession.driver.sleep(1500)
    const title = await browserSession.driver.getTitle()

    expect(title).not.toBe(expectedTitle)
    expect(title).toBe('Unavailable | Censor Tracker')
  }, 10000)
})
