import { enforceHttpConnection } from '../core'

(async () => {
  const unavailableWebsite = document.getElementById('unavailableWebsite')
  const openThroughProxyButton = document.getElementById('openThroughProxy')

  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })

  const [, encodedHostname] = tab.url.split('?')
  const targetUrl = window.atob(encodedHostname)
  const finalUrl = enforceHttpConnection(targetUrl)

  unavailableWebsite.innerText = finalUrl

  if (encodedHostname && openThroughProxyButton) {
    openThroughProxyButton.disabled = false
    openThroughProxyButton.classList.remove('btn-hidden')
    openThroughProxyButton.classList.remove('btn-disabled')
  }

  document.addEventListener('click', (event) => {
    if (event.target.matches('#openThroughProxy')) {
      browser.tabs.create({ url: finalUrl, index: tab.index }, () => {
        browser.tabs.remove(tab.id)
      })
    }

    if (event.target.matches('#tryAgain')) {
      browser.tabs.update(tab.id, { url: finalUrl })
    }

    if (event.target.matches('#closeTab')) {
      browser.tabs.remove(tab.id)
    }

    event.preventDefault()
  }, false)
})()
