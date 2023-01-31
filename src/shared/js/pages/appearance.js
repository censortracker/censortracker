import browser from 'Background/browser-api'

(async () => {
  const darkStylesheetId = 'dark-theme-css'

  const darkMode = () => {
    const filename = window.location.href.split('/').pop()
    // FIXME: Nope, this is not a good idea, pal.
    const pageType = filename.indexOf('popup') !== -1 ? 'popup' : 'options'
    const link = document.createElement('link')

    link.rel = 'stylesheet'
    link.id = darkStylesheetId
    link.href = `css/${pageType}-dark.css`

    document.head.append(link)
  }

  const lightMode = () => {
    const link = document.getElementById(darkStylesheetId)

    if (link) {
      link.remove()
    }
  }

  browser.storage.local.get({ useDarkTheme: false })
    .then(({ useDarkTheme }) => {
      if (useDarkTheme) {
        darkMode()
      } else {
        lightMode()
      }
    })

  browser.storage.onChanged.addListener(async (
    { useDarkTheme: { newValue, oldValue } } = {}, _areaName) => {
    if (newValue) {
      darkMode()
    } else {
      lightMode()
    }
  })
})()
