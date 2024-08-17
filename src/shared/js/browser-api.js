/**
 * Returns the browser information.
 * @returns {{name: *, version: *}}
 */
export const getBrowserInfo = () => {
  const userAgent = navigator.userAgent
  const uaMatch = userAgent.match(/(Firefox|Chrome)\/(\d+)/) || []

  if (uaMatch[1] === 'Chrome') {
    const innerMatch = userAgent.match(/(Edg|OPR|YaBrowser)\/(\d+)/) || []

    if (innerMatch[1] === 'OPR') {
      uaMatch[1] = 'Opera'
    } else if (innerMatch[1] === 'Edg') {
      uaMatch[1] = 'Microsoft Edge'
    } else if (innerMatch[1] === 'YaBrowser') {
      uaMatch[1] = 'Yandex Browser'
    }
  }
  return { name: uaMatch[1], version: uaMatch[2] }
}

/**
 * Returns the browser's API object.
 * @returns {*}
 */
const getBrowser = () => {
  if (typeof browser !== 'undefined') {
    browser.isFirefox = true
    return browser
  }
  chrome.isFirefox = false
  return chrome
}

export default getBrowser()
