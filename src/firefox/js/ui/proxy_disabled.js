(async () => {
  const unavailableWebsite = document.getElementById('unavailableWebsite')

  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
  const [, encodedHostname] = tab.url.split('?')
  const targetUrl = window.atob(encodedHostname)

  unavailableWebsite.innerText = window.atob(encodedHostname)

  document.addEventListener('click', async (event) => {
    if (event.target.matches('#openThroughProxy')) {
      browser.tabs.create({ url: targetUrl, index: tab.index }, () => {
        browser.tabs.remove(tab.id)
      })
    }

    if (event.target.matches('#doNotAskAnymore')) {
      const { censortracker: { browserListeners } } = await browser.runtime.getBackgroundPage()

      if (browserListeners.has()) {
        browserListeners.remove()
      }

      browser.tabs.update(tab.id, { url: targetUrl })
    }

    event.preventDefault()
  }, false)
})()
