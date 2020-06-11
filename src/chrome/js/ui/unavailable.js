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
        chrome.runtime.getBackgroundPage(async (bgWindow) => {
          const { proxies } = bgWindow.censortracker

          await proxies.setProxy(targetUrl)
          chrome.tabs.create({ url: targetUrl }, () => {
            chrome.tabs.remove(tab.id)
          })
        })
      }
    })

    event.preventDefault()
  },
  false,
)
