(() => {
  const port = chrome.runtime.connect({ name: 'censortracker' })

  // Ask if parental control is isEnabled.
  port.postMessage({ parentalControl: '?' })
  port.onMessage.addListener((message) => {
    if (message.parentalControl) {
      const overlay = document.createElement('div')

      overlay.id = 'overlay'

      document.body.prepend(overlay)
    }
  })
})()
