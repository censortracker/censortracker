import asynchrome from '../../chrome/js/core/asynchrome'

/**
 * Returns browser API object.
 * @returns {Asynchrome|*}
 */
export const getBrowser = () => {
  try {
    browser.runtime.getBrowserInfo()
    return browser
  } catch (error) {
    return asynchrome
  }
}

/**
 * Returns true if browser is Firefox.
 * @returns {boolean}
 */
export const isFirefox = () => {
  try {
    browser.runtime.getBrowserInfo()
    return true
  } catch (error) {
    return false
  }
}
