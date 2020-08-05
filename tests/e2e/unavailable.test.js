import { By } from 'selenium-webdriver'

import { createDriver, getProxyUnavailablePage, getUnavailablePage } from './selenium'

describe('Testing unavailable pages: unavailable.html and proxy_unavailable.html ', () => {
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
    const browser = await createDriver()

    await browser.get(url)
    const title = await browser.getTitle()

    expect(title).toBe(expectedTitle)

    await browser.findElement(By.id('closeTab')).click()
    await browser.quit()
  }, 10000)
})
