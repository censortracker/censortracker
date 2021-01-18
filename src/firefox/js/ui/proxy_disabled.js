import proxy from '../core/proxy'

(async () => {
  const unavailableWebsite = document.getElementById('unavailableWebsite')

  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
  const [, encodedHostname] = tab.url.split('?')
  const targetUrl = window.atob(encodedHostname)

  unavailableWebsite.innerText = window.atob(encodedHostname)

  document.addEventListener('click', async (event) => {
    if (event.target.matches('#openThroughProxy')) {
      await proxy.setProxy()

      chrome.tabs.create({ url: targetUrl, index: tab.index }, () => {
        chrome.tabs.remove(tab.id)
      })
    }

    if (event.target.matches('#doNotAskAnymore')) {
      const { censortracker: { chromeListeners } } = await browser.runtime.getBackgroundPage()

      if (chromeListeners.has()) {
        chromeListeners.remove()
      }

      chrome.tabs.update(tab.id, { url: targetUrl })
    }

    event.preventDefault()
  }, false)
})()
