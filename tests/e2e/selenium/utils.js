import { until } from 'selenium-webdriver'

export const waitGetElement = async (browser, locator, timeout = 2000) => {
  try {
    await browser.findElement(locator)
    const element = await browser.wait(until.elementLocated(locator), timeout)

    return await browser.wait(until.elementIsVisible(element), timeout)
  } catch (error) {
    return undefined
  }
}

export const isElementExists = async (browser, locator, timeout = 2000) => {
  const result = await waitGetElement(browser, locator, timeout)

  return result !== undefined
}
