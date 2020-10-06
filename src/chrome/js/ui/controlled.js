(() => {
  const backToPopup = document.getElementById('backToPopup')
  const extensionsPage = document.getElementById('chromeExtensionsPage')

  backToPopup.addEventListener('click', () => {
    window.location.href = chrome.runtime.getURL('popup.html')
  })

  extensionsPage.addEventListener('click', () => {
    chrome.tabs.create({ url: 'chrome://extensions/' })
  })
})()
