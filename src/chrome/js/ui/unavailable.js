import { extractDecodedOriginUrl } from '@/common/js/utilities';

(async () => {
  const openThroughProxyButton = document.getElementById('openThroughProxy')

  const handleTabState = async (tabId, changeInfo, tab) => {
    if (changeInfo && changeInfo.status === 'complete') {
      const originUrl = extractDecodedOriginUrl(window.location.href)

      document.getElementById('unavailableWebsite').innerText = originUrl

      if (originUrl && openThroughProxyButton) {
        openThroughProxyButton.classList.remove('btn-hidden')
      }

      document.addEventListener('click', (event) => {
        if (event.target.matches('#openThroughProxy')) {
          chrome.tabs.create({ url: originUrl, index: tab.index }, () => {
            chrome.tabs.remove(tab.id)
          })
        }

        if (event.target.matches('#tryAgain')) {
          chrome.tabs.update(tab.id, { url: originUrl })
        }

        if (event.target.matches('#closeTab')) {
          chrome.tabs.remove(tab.id)
        }

        event.preventDefault()
      }, false)

      setTimeout(() => {
        if (openThroughProxyButton && openThroughProxyButton.classList.contains('btn-disabled')) {
          openThroughProxyButton.classList.remove('btn-disabled')
          openThroughProxyButton.disabled = false
        }
      }, 3500)
    }
  }

  chrome.tabs.onUpdated.addListener(handleTabState)
})()
