import asynchrome from '../core/asynchrome'
import proxy from '../core/proxy'

(async () => {
  const [{ id, index }] = await asynchrome.tabs.query({ active: true, lastFocusedWindow: true })

  const [, encodedHostname] = window.location.href.split('?')
  const targetUrl = window.atob(encodedHostname)

  document.getElementById('unavailableWebsite').innerText = window.atob(encodedHostname)

  document.addEventListener('click', async (event) => {
    if (event.target.matches('#openThroughProxy')) {
      await proxy.setProxy()
      chrome.tabs.create({ url: targetUrl, index }, () => {
        chrome.tabs.remove(id)
      })
    }

    if (event.target.matches('#doNotAskAnymore')) {
      const { censortracker: { webRequestListeners } } = await asynchrome.runtime.getBackgroundPage()

      if (webRequestListeners.activated()) {
        webRequestListeners.deactivate()
      }

      chrome.tabs.update(id, { url: targetUrl })
    }

    event.preventDefault()
  }, false)
})()
