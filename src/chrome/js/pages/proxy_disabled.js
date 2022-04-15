import { proxy, translateDocument } from '@/common/js'
import * as utilities from '@/common/js/utilities'

(async () => {
  const originUrl = utilities.extractDecodedOriginUrl(window.location.href)
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })

  translateDocument(document, { url: originUrl })

  document.addEventListener('click', async (event) => {
    if (event.target.matches('#openThroughProxy')) {
      const proxySet = await proxy.setProxy() // TODO: Use sendMessage to set proxy

      if (proxySet === true) {
        chrome.tabs.create({ url: originUrl, index: tab.index }, () => {
          chrome.tabs.remove(tab.id)
        })
      }
    }

    if (event.target.matches('#doNotAskAnymore')) {
      chrome.tabs.update(tab.id, { url: originUrl })
    }

    event.preventDefault()
  }, false)
})()
