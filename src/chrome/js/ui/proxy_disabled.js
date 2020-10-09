import asynchrome from '../core/asynchrome'
import proxy from '../core/proxy'

(async () => {
  const unavailableWebsite = document.getElementById('unavailableWebsite')

  const [tab] = await asynchrome.tabs.query({ active: true, lastFocusedWindow: true })
  const [, encodedHostname] = tab.url.split('?')
  const targetUrl = window.atob(encodedHostname)

  unavailableWebsite.innerText = window.atob(encodedHostname)

  document.addEventListener('click', async (event) => {
    if (event.target.matches('#extendProxyAutoConfig')) {
      await proxy.setProxy()

      chrome.tabs.create({ url: targetUrl, index: tab.index }, () => {
        chrome.tabs.remove(tab.id)
      })
    }

    if (event.target.matches('#doNotAskAnymore')) {
      console.log('Don\'t ask anymore')
    }

    event.preventDefault()
  }, false)
})()
