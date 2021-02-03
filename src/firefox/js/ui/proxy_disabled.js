(async () => {
  const { censortracker: { events, proxy } } = await browser.runtime.getBackgroundPage()

  const unavailableWebsite = document.getElementById('unavailableWebsite')

  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
  const [, encodedHostname] = tab.url.split('?')
  const targetUrl = window.atob(encodedHostname)

  unavailableWebsite.innerText = targetUrl

  document.addEventListener('click', async (event) => {
    if (event.target.matches('#openThroughProxy')) {
      await proxy.enableProxy()
      browser.tabs.create({ url: targetUrl, index: tab.index }, () => {
        browser.tabs.remove(tab.id)
      })
    }

    if (event.target.matches('#doNotAskAnymore')) {
      if (events.hasListeners()) {
        events.removeListeners()
      }

      browser.tabs.update(tab.id, { url: targetUrl })
    }

    event.preventDefault()
  }, false)
})()
