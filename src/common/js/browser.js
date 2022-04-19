const isFirefox = () => typeof browser !== 'undefined'

const getBrowser = () => {
  if (isFirefox()) {
    return browser
  }
  return chrome
}

export class Browser {
  constructor () {
    this.browser = getBrowser()
    this.isFirefox = isFirefox()
    this.isChromium = !this.isFirefox
    this.manifest = this.browser.runtime.getManifest()
  }
}
