(async () => {
  const unavailableWebsite = document.getElementById('unavailableWebsite')

  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
  const [, encodedHostname] = tab.url.split('?')
  const targetUrl = window.atob(encodedHostname)

  unavailableWebsite.innerText = targetUrl

  document.addEventListener('click', async (event) => {
    if (event.target.matches('#openThroughProxy')) {
      browser.tabs.create({ url: targetUrl, index: tab.index }, () => {
        browser.tabs.remove(tab.id)
      })
    }

    if (event.target.matches('#doNotAskAnymore')) {
      const { censortracker: { events } } = await browser.runtime.getBackgroundPage()

      if (events.hasListeners()) {
        events.remove()
      }

      browser.tabs.update(tab.id, { url: targetUrl })
    }

    event.preventDefault()
  }, false)
})()
