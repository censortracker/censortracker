(() => {
  const baseUrl = 'https://raw.githubusercontent.com/roskomsvoboda/' +
    'censortracker/gh-pages/static/img/pc/'

  const randomInteger = () => Math.floor(Math.random() * 5) + 1
  const port = chrome.runtime.connect({ name: 'censortracker' })

  // Ask if parental control is isEnabled.
  port.postMessage({ parentalControl: '?' })
  port.onMessage.addListener((message) => {
    if (message.parentalControl) {
      const overlay = document.createElement('div')

      overlay.id = 'ct-parental-control-overlay'
      overlay.style.backgroundImage = `url(${baseUrl}${randomInteger(1, 5)}.svg)`
      document.body.prepend(overlay)
    }
  })
})()
