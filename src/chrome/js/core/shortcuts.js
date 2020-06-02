'use strict'

;(() => {
  const validURL = (urlStr) => {
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

  const cleanHostname = (hostname) => {
    const regexp = /^(?:https?:\/\/)?(?:www\.)?/i
    return hostname.replace(regexp, '').trim()
  }

  const createSearchLink = (hostname) => {
    const searchUrl = 'https://reestr.rublacklist.net/search/'
    return `<a href="${searchUrl}?q=${hostname}" target="_blank">Да</a>`
  }

  const enableExtension = () => {
    chrome.storage.local.set(
      {
        enableExtension: true,
      },
      () => {
        console.warn('Extension enabled')
      },
    )
  }

  const disableExtension = () => {
    chrome.storage.local.set(
      {
        enableExtension: false,
      },
      () => {
        console.warn('Extension disabled')
      },
    )
  }

  window.shortcuts = {
    validURL: validURL,
    cleanHostname: cleanHostname,
    enableExtension: enableExtension,
    disableExtension: disableExtension,
    createSearchLink: createSearchLink,
  }
})()
