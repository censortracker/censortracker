import { extractDecodedOriginUrl, translateDocument } from '@/common/js'

(async () => {
  translateDocument(document)
  const unavailableWebsite = document.getElementById('unavailableWebsite')
  const openThroughProxyButton = document.getElementById('openThroughProxy')

  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })

  const originUrl = extractDecodedOriginUrl(tab.url)

  unavailableWebsite.innerText = originUrl

  if (originUrl && openThroughProxyButton) {
    openThroughProxyButton.disabled = false
    openThroughProxyButton.classList.remove('btn-hidden')
    openThroughProxyButton.classList.remove('btn-disabled')
  }

  document.addEventListener('click', (event) => {
    if (event.target.matches('#openThroughProxy')) {
      browser.tabs.create({ url: originUrl, index: tab.index }, () => {
        browser.tabs.remove(tab.id)
      })
    }

    if (event.target.matches('#tryAgain')) {
      browser.tabs.update(tab.id, { url: originUrl })
    }

    if (event.target.matches('#closeTab')) {
      browser.tabs.remove(tab.id)
    }

    event.preventDefault()
  }, false)
})()
