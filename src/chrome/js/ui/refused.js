document.addEventListener(
  'click',
  (event) => {
    chrome.tabs.query({ active: true, lastFocusedWindow: true }, ([tab]) => {
      const [, encodedUrl] = tab.url.split('?')

      if (event.target.matches('#enforce_proxy')) {
        chrome.tabs.create({ url: window.atob(encodedUrl) }, () => {
          chrome.tabs.remove(tab.id)
        })
      }
    })

    event.preventDefault()
  },
  false,
)
