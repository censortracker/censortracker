import { proxy, translateDocument } from '@/common/js'
import { extractDecodedOriginUrl } from '@/common/js/utilities'

(async () => {
  const currentBrowser = proxy.getBrowser()
  const originUrl = extractDecodedOriginUrl(window.location.href)
  const [tab] = await currentBrowser.tabs.query({ active: true, lastFocusedWindow: true })

  translateDocument(document, { url: originUrl })

  document.addEventListener('click', async (event) => {
    if (event.target.matches('#openThroughProxy')) {
      const proxySet = await proxy.setProxy()

      if (proxySet) {
        await currentBrowser.tabs.create({ url: originUrl, index: tab.index }, () => {
          currentBrowser.tabs.remove(tab.id)
        })
      }
    }

    if (event.target.matches('#doNotAskAnymore')) {
      const { censortracker: { webRequestListeners } } = await currentBrowser.runtime.getBackgroundPage()

      if (webRequestListeners.activated()) {
        webRequestListeners.deactivate()
      }

      await currentBrowser.tabs.update(tab.id, { url: originUrl })
    }

    event.preventDefault()
  }, false)
})()
