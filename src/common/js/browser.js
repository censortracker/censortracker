const getBrowser = () => {
  if (typeof browser !== 'undefined') {
    return browser
  }
  return chrome
}

const browser = getBrowser()

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

export class Browser {
  constructor () {
    this.browser = getBrowser()
    this.isFirefox = isFirefox()
    this.isChromium = !this.isFirefox
    this.manifest = this.browser.runtime.getManifest()
  }
}
