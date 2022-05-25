(() => {
  const getBackgroundImageURL = () => {
    const filename = Math.floor(Math.random() * 5) + 1
    const githubBaseHost = 'https://raw.githubusercontent.com'

    return `${githubBaseHost}/roskomsvoboda/assets/v1/${filename}.svg`
  }

  const port = chrome.runtime.connect({ name: 'censortracker' })

  // Ask if parental control is isEnabled.
  port.postMessage({ parentalControl: '?' })
  port.onMessage.addListener((message) => {
    if (message.parentalControl) {
      const overlay = document.createElement('div')

      overlay.id = 'ct-parental-control-overlay'
      overlay.style.backgroundImage = `url(${getBackgroundImageURL()})`
      document.body.prepend(overlay)
    }
  })

  const first = 0
  const second = 0

  if (first >= second) {
    console.log(`${first} >= ${second} A:E a:e`)
  }
})()
