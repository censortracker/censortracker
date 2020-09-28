/**
 * Validate passed URL using regex.
 * @param url URL
 * @returns {boolean} true if valid otherwise false
 */
export const validateUrl = (url) => {
  const pattern = new RegExp(
    '^(https?:\\/\\/)?' +
    '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' +
    '((\\d{1,3}\\.){3}\\d{1,3}))' +
    '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' +
    '(\\?[;&a-z\\d%_.~+=-]*)?' +
    '(\\#[-a-z\\d_]*)?$',
    'i',
  )

  if (url.startsWith('chrome-extension://')) {
    return false
  }

  return !!pattern.test(url)
}

/**
 * Extract hostname from the URL address.
 * @param url URL string.
 * @returns {string} Extracted hostname.
 */
export const extractHostnameFromUrl = (url) => {
  const regEx = /^(?:https?:\/\/)?(?:www\.)?/i

  url = url.replace(regEx, '')

  if (url.indexOf('/') !== -1) {
    url = url.split('/')[0]
  }

  url = url.trim()

  try {
    return new URL(url).hostname
  } catch (error) {
    return url
  }
}

/**
 * Enforce HTTPS in for the passed URL.
 * @param url URL address.
 * @returns {*} URL with "https://" prefix.
 */
export const enforceHttpsConnection = (url) => {
  return url.replace(/^http:/, 'https:')
}
