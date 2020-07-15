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

    if (this.isChromeExtensionUrl(urlStr)) {
      return false
    }

    return !!pattern.test(urlStr)
  }

  cleanHostname = (hostname) => {
    hostname = hostname.replace(
      /^(?:https?:\/\/)?(?:www\.)?/i, '').trim()

    let lastDot = hostname.lastIndexOf('.')

    if (lastDot !== -1) {
      lastDot = hostname.lastIndexOf('.', lastDot - 1)
      if (lastDot !== -1) {
        hostname = hostname.substr(lastDot + 1)
      }
    }

    return hostname
  }

  isChromeExtensionUrl = (url) => {
    return url.startsWith('chrome-extension://')
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
