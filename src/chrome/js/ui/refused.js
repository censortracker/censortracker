document.addEventListener(
  'click',
  (event) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, (tabs) => {
      const encodedUrl = tabs[0].url.split('?')[1]
      const url = window.atob(encodedUrl)

      if (event.target.matches('#enforce_proxy')) {
        chrome.tabs.create({ url }, (_tab) => {
          chrome.tabs.remove(tabs[0].id)
        })
      }
    })

    event.preventDefault()
  },
  false,
)
