import {
  createDriver,
  getGeneratedBackgroundPage,
} from './selenium'

describe('Testing unavailable websites without proxy', () => {
  let driver
  let extensionId

  beforeAll(async () => {
    ({ driver, extensionId } = await createDriver())
  })

  afterAll(async () => {
    await driver.quit()
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
    await getGeneratedBackgroundPage({ driver, extensionId })
    await driver.executeScript('chrome.proxy.settings.clear({ scope: "regular" })')
    await driver.get(url)
    await driver.sleep(1500)
    const title = await driver.getTitle()

    expect(title).not.toBe(expectedTitle)
    expect(title).toBe('Unavailable | Censor Tracker')
  }, 10000)
})
