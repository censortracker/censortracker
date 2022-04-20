const getBrowser = () => {
  if (typeof browser !== 'undefined') {
    browser.isFirefox = true
    return browser
  }
  chrome.isFirefox = false
  return chrome
}

export default getBrowser()
