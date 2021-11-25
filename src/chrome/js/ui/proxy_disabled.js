import { asynchrome } from '@/chrome/js/core'
import { extractDecodedOriginUrl, proxy, translateDocument } from '@/common/js'

(async () => {
  const originUrl = extractDecodedOriginUrl(window.location.href)
  const [tab] = await asynchrome.tabs.query({ active: true, lastFocusedWindow: true })

  translateDocument(document, { url: originUrl })

  document.addEventListener('click', async (event) => {
    if (event.target.matches('#openThroughProxy')) {
      proxy.setProxy().then(() => {
        chrome.tabs.create({ url: originUrl, index: tab.index }, () => {
          chrome.tabs.remove(tab.id)
        })
      })
    }

    if (event.target.matches('#doNotAskAnymore')) {
      chrome.tabs.update(tab.id, { url: originUrl })
    }

    event.preventDefault()
  }, false)
})()
