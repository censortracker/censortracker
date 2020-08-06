import { until } from 'selenium-webdriver'

export const isElementExists = async (browser, locator, timeout = 1000) => {
  try {
    await browser.findElement(locator)
    const element = await browser.wait(until.elementLocated(locator), timeout)

    await browser.wait(until.elementIsVisible(element), timeout)
    return true
  } catch (error) {
    return false
  }
}
