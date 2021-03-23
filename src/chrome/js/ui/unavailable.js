(async () => {
  const unavailableWebsite = document.getElementById('unavailableWebsite')
  const openThroughProxyButton = document.getElementById('openThroughProxy')

  const handleTabState = async (tabId, changeInfo, tab) => {
    if (changeInfo && changeInfo.status === 'complete') {
      const [, encodedHostname] = window.location.href.split('?')
      const targetUrl = window.atob(encodedHostname)

      unavailableWebsite.innerText = window.atob(encodedHostname)

      if (encodedHostname && openThroughProxyButton) {
        openThroughProxyButton.classList.remove('btn-hidden')
      }

      document.addEventListener('click', (event) => {
        if (event.target.matches('#openThroughProxy')) {
          chrome.tabs.create({ url: targetUrl, index: tab.index }, () => {
            chrome.tabs.remove(tab.id)
          })
        }

        if (event.target.matches('#tryAgain')) {
          chrome.tabs.update(tab.id, { url: targetUrl })
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
