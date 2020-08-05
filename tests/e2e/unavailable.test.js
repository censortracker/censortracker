import { createDriver, getProxyUnavailablePage, getUnavailablePage } from './selenium'

describe('Testing unavailable pages: unavailable.html and proxy_unavailable.html ', () => {
  let browser

  beforeAll(async () => {
    browser = await createDriver()
  })

  afterAll(async () => {
    await browser.quit()
  })

  const pages = [
    {
      url: getUnavailablePage(),
      expectedTitle: 'Unavailable | Censor Tracker',
    },
    {
      url: getProxyUnavailablePage(),
      expectedTitle: 'Proxy Unavailable | Censor Tracker',
    },
  ]

  it.each(pages)('it should interact with unavailable pages', async ({ url, expectedTitle }) => {
    await browser.get(url)
    const title = await browser.getTitle()

    expect(title).toBe(expectedTitle)

    await browser.findElement({ id: 'closeTab' }).click()
  }, 10000)
})
