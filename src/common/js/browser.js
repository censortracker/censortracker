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

export const getBrowserName = async () => {
  try {
    await browser.runtime.getBrowserInfo()
    return { firefox: true }
  } catch (error) {
    return { chrome: true }
  }
}
