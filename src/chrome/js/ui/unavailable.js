document.addEventListener(
  'click',
  (event) => {
    chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    }, ([tab]) => {
      const [, encodedHostname] = tab.url.split('?')
      const targetUrl = window.atob(encodedHostname)

      if (event.target.matches('#extendProxyAutoConfig')) {
        chrome.tabs.create({ url: targetUrl, index: tab.index }, () => {
          chrome.tabs.remove(tab.id)
        })
      }

      if (event.target.matches('#exitUnavailablePage')) {
        chrome.tabs.remove(tab.id)
      }
    })

    event.preventDefault()
  },
  false,
)
