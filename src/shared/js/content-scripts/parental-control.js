(() => {
  const filename = Math.floor(Math.random() * 5) + 1
  const port = chrome.runtime.connect({ name: 'censortracker' })

  // Ask if parental control is isEnabled.
  port.postMessage({ parentalControl: '?' })
  port.onMessage.addListener((message) => {
    if (message.parentalControl) {
      const overlay = document.createElement('div')

      overlay.id = 'ct-parental-control-overlay'
      overlay.style.backgroundImage = `url("https://roskomsvoboda.github.io/assets/${filename}.svg")`
      document.body.prepend(overlay)
    }
  })
})()
