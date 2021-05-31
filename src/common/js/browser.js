import asynchrome from '@/chrome/js/core/asynchrome'

/**
 * Returns browser API object.
 * @returns {Asynchrome|*}
 */
const getBrowser = () => {
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
const isFirefox = () => {
  try {
    browser.runtime.getBrowserInfo()
    return true
  } catch (error) {
    return false
  }
}

export const IS_FIREFOX = isFirefox()

export class BrowserAPI {
  constructor () {
    this.browser = getBrowser()
    this.isFirefox = isFirefox()
    this.manifest = this.browser.runtime.getManifest()
  }
}
