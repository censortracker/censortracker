class Shortcuts {
  validURL = (urlStr) => {
    const pattern = new RegExp(
      '^(https?:\\/\\/)?' +
      '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' +
      '((\\d{1,3}\\.){3}\\d{1,3}))' +
      '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' +
      '(\\?[;&a-z\\d%_.~+=-]*)?' +
      '(\\#[-a-z\\d_]*)?$',
      'i',
    )

    return !!pattern.test(urlStr)
  }

  cleanHostname = (hostname) => {
    const regexp = /^(?:https?:\/\/)?(?:www\.)?/i

    return hostname.replace(regexp, '').trim()
  }

  createSearchLink = (hostname) => {
    const searchUrl = 'https://reestr.rublacklist.net/search/'

    return `<a href="${searchUrl}?q=${hostname}" target="_blank">Да</a>`
  }

  enforceHttps = (hostname) => {
    return hostname.replace(/^http:/, 'https:')
  }
}

export default new Shortcuts()
