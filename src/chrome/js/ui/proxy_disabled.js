import { extractDecodedOriginUrl } from '@/common/js/utilities'

import asynchrome from '../core/asynchrome'
import proxy from '../core/proxy'

(async () => {
  const originUrl = extractDecodedOriginUrl(window.location.href)
  const [tab] = await asynchrome.tabs.query({ active: true, lastFocusedWindow: true })

  document.getElementById('unavailableWebsite').innerText = originUrl
  document.addEventListener('click', async (event) => {
    if (event.target.matches('#openThroughProxy')) {
      await proxy.setProxy()
      chrome.tabs.create({ url: originUrl, index: tab.index }, () => {
        chrome.tabs.remove(tab.id)
      })
    }

    if (event.target.matches('#doNotAskAnymore')) {
      const { censortracker: { webRequestListeners } } = await asynchrome.runtime.getBackgroundPage()

      if (webRequestListeners.activated()) {
        webRequestListeners.deactivate()
      }

      chrome.tabs.update(tab.id, { url: originUrl })
    }

    event.preventDefault()
  }, false)
})()
