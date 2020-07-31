import { By } from 'selenium-webdriver'

import createDriver from '../../selenium'
import getPageByFilename from '../../selenium/utils'

describe('Testing unavailable pages: unavailable.html and proxy_unavailable.html ', () => {
  const pages = [
    {
      url: getPageByFilename('unavailable.html'),
      expectedTitle: 'Unavailable | Censor Tracker',
    },
    {
      url: getPageByFilename('proxy_unavailable.html'),
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
  })
})
