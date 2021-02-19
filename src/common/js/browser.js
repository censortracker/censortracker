import asynchrome from '../../chrome/js/core/asynchrome'

/**
 * Returns browser API object.
 * @returns {Asynchrome|*}
 */
export const getBrowser = () => {
  try {
    return browser
  } catch (error) {
    return asynchrome
  }
}

export const isFirefox = async () => {
  try {
    await browser.runtime.getBrowserInfo()
    return true
  } catch (error) {
    return false
  }
}
