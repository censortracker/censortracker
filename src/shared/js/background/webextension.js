const getBrowser = () => {
  if (typeof browser !== 'undefined') {
    browser.IS_FIREFOX = true
    return browser
  }
  chrome.IS_FIREFOX = false
  return chrome
}

export default getBrowser()
