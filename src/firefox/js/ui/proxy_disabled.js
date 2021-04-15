import { extractDecodedOriginUrl } from '@/common/js/utilities'
import proxy from '@/firefox/js/core/proxy';

(async () => {
  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
  const originUrl = extractDecodedOriginUrl(tab.url)
  const unavailableWebsite = document.getElementById('unavailableWebsite')

  unavailableWebsite.innerText = originUrl

  document.addEventListener('click', async (event) => {
    if (event.target.matches('#openThroughProxy')) {
      await proxy.enableProxy()
      browser.tabs.create({ url: originUrl, index: tab.index }, () => {
        browser.tabs.remove(tab.id)
      })
    }

    if (event.target.matches('#doNotAskAnymore')) {
      // TODO: Disable listeners
      browser.tabs.update(tab.id, { url: originUrl })
    }

    event.preventDefault()
  }, false)
})()
