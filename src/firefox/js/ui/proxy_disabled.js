import { proxy, translateDocument } from '@/common/js'
import { extractDecodedOriginUrl } from '@/common/js/utilities'

(async () => {
  translateDocument(document)
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
  const originUrl = extractDecodedOriginUrl(tab.url)
  const unavailableWebsite = document.getElementById('unavailableWebsite')

  unavailableWebsite.innerText = originUrl

  document.addEventListener('click', async (event) => {
    if (event.target.matches('#openThroughProxy')) {
      await proxy.setProxy()
      browser.tabs.create({ url: originUrl, index: tab.index }, () => {
        browser.tabs.remove(tab.id)
      })
    }

    if (event.target.matches('#doNotAskAnymore')) {
      const { censortracker: { webRequestListeners } } = await browser.runtime.getBackgroundPage()

      if (webRequestListeners.activated()) {
        webRequestListeners.deactivate()
      }

      browser.tabs.update(tab.id, { url: originUrl })
    }

    event.preventDefault()
  }, false)
})()
