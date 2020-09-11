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

export const enforceHttpsConnection = (hostname) => {
  return hostname.replace(/^http:/, 'https:')
}
