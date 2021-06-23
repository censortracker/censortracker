import { proxy, translateDocument } from '@/common/js'
import { extractDecodedOriginUrl } from '@/common/js/utilities'

(async () => {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
  const originUrl = extractDecodedOriginUrl(tab.url)

  translateDocument(document, { url: originUrl })

  document.addEventListener('click', async (event) => {
    if (event.target.matches('#openThroughProxy')) {
      proxy.setProxy().then(() => {
        browser.tabs.create({ url: originUrl, index: tab.index }, () => {
          browser.tabs.remove(tab.id)
        })
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
