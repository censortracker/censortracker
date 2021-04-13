import asynchrome from '../core/asynchrome'

(async () => {
  const unavailableWebsite = document.getElementById('unavailableWebsite')

  const [tab] = await asynchrome.tabs.query({ active: true, lastFocusedWindow: true })
  const [, encodedHostname] = tab.url.split('?')
  const targetUrl = window.atob(encodedHostname)

  unavailableWebsite.innerText = window.atob(encodedHostname)

  document.addEventListener('click', async (event) => {
    if (event.target.matches('#openThroughProxy')) {
      chrome.tabs.create({ url: targetUrl, index: tab.index }, () => {
        chrome.tabs.remove(tab.id)
      })
    }

    if (event.target.matches('#doNotAskAnymore')) {
      const { censortracker: { webRequestListeners } } = await asynchrome.runtime.getBackgroundPage()

      if (webRequestListeners.activated()) {
        webRequestListeners.deactivate()
      }

      chrome.tabs.update(tab.id, { url: targetUrl })
    }

    event.preventDefault()
  }, false)
})()
