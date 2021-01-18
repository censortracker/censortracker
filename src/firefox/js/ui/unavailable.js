(async () => {
  const unavailableWebsite = document.getElementById('unavailableWebsite')
  const extendProxyButton = document.getElementById('extendProxyAutoConfig')

  const [tab] = await browser.tabs.query({ active: true, lastFocusedWindow: true })

  const [, encodedHostname] = tab.url.split('?')
  const targetUrl = window.atob(encodedHostname)

  unavailableWebsite.innerText = window.atob(encodedHostname)

  if (encodedHostname && extendProxyButton) {
    extendProxyButton.classList.remove('btn-hidden')
  }

  document.addEventListener('click', (event) => {
    if (event.target.matches('#extendProxyAutoConfig')) {
      browser.tabs.create({ url: targetUrl, index: tab.index }, () => {
        browser.tabs.remove(tab.id)
      })
    }

    if (event.target.matches('#tryAgain')) {
      browser.tabs.update(tab.id, { url: targetUrl })
    }

    if (event.target.matches('#closeTab')) {
      browser.tabs.remove(tab.id)
    }

    event.preventDefault()
  }, false)

  setTimeout(() => {
    if (extendProxyButton && extendProxyButton.classList.contains('btn-disabled')) {
      extendProxyButton.classList.remove('btn-disabled')
      extendProxyButton.disabled = false
    }
  }, 3500)
})()
