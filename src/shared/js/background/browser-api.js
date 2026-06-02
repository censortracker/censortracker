/**
 * Returns the browser information.
 * @returns {{name: *, version: *}}
 */
export const getBrowserInfo = () => {
  const userAgent = navigator.userAgent
  const uaMatch = userAgent.match(/(Firefox|Chrome)\/(\d+)/) || []

  if (uaMatch[1] === 'Chrome') {
    // The order matters: Edge/Opera/Yandex all also report "Chrome/<ver>".
    const innerMatch =
      userAgent.match(/(Edg|EdgA|EdgiOS|OPR|YaBrowser|Vivaldi|Brave)\/(\d+)/) ||
      []

    if (innerMatch[1] === 'OPR') {
      uaMatch[1] = 'Opera'
    } else if (innerMatch[1] && innerMatch[1].startsWith('Edg')) {
      uaMatch[1] = 'Microsoft Edge'
    } else if (innerMatch[1] === 'YaBrowser') {
      uaMatch[1] = 'Yandex Browser'
    } else if (innerMatch[1] === 'Vivaldi') {
      uaMatch[1] = 'Vivaldi'
    } else if (innerMatch[1] === 'Brave') {
      uaMatch[1] = 'Brave'
    }
  } else if (uaMatch.length === 0 && /Safari\//.test(userAgent)) {
    // Safari does not expose a "Chrome/" token but does expose "Version/".
    const safariMatch = userAgent.match(/Version\/(\d+)/) || []

    return { name: 'Safari', version: safariMatch[1] }
  }
  return { name: uaMatch[1], version: uaMatch[2] }
}

/**
 * Detects whether the current runtime is a genuine Firefox (Gecko) browser.
 *
 * We can't simply check for the presence of the global `browser` object:
 * starting with Chromium 148 the `browser` namespace is also exposed in
 * service workers, and several Chromium-based browsers (Edge, Opera, Yandex)
 * ship a `browser` alias too. `runtime.getBrowserInfo` is a Firefox-only
 * API, which makes it the only reliable way to tell a real Firefox apart
 * from a Chromium that merely exposes a `browser` alias.
 * @returns {boolean}
 */
const isGeckoRuntime = () => {
  try {
    return (
      typeof browser !== 'undefined' &&
      !!browser.runtime &&
      typeof browser.runtime.getBrowserInfo === 'function'
    )
  } catch (error) {
    return false
  }
}

/**
 * Returns the browser's API object, normalized across vendors.
 *
 * Order of preference:
 *   1. Genuine Firefox -> use the promise-based `browser` namespace.
 *   2. Chrome/Edge/Opera/Yandex/Brave/Vivaldi and other Chromium browsers,
 *      as well as Safari Web Extensions -> prefer `chrome`, otherwise fall
 *      back to a `browser` alias.
 * @returns {*}
 */
const getBrowser = () => {
  if (isGeckoRuntime()) {
    browser.isFirefox = true
    return browser
  }

  if (typeof chrome !== 'undefined') {
    chrome.isFirefox = false
    return chrome
  }

  if (typeof browser !== 'undefined') {
    browser.isFirefox = false
    return browser
  }

  throw new Error('No supported extension API (chrome/browser) found.')
}

export default getBrowser()
