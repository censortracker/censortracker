import browser from '../../../../browser-api'

export const createOffScreenDocument = (() => {
  let creating // A global promise to avoid concurrency issues

  return async () => {
    if (creating) {
      await creating
    } else {
      creating = browser.offscreen.createDocument({
        url: 'offscreen.html',
        reasons: [browser.offscreen.Reason.WORKERS],
        justification: 'needed to trigger on auth required handler',
      })
      await creating
      creating = null
    }
  }
})()

export const triggerAuth = async () => {
  console.log('manual auth trigger caught!')

  if (browser.isFirefox) {
    try {
      // After setting proxy, we need to send a random request. Otherwise, PAC-script can be cached
      await fetch('https://example.com/', { cache: 'no-cache' })
    } catch (error) {
      // ignore
    }
  } else {
    try {
      await createOffScreenDocument()
    } catch (error) {
      // if the offscreen document is already created, we just print error in the console
      console.log(error)
    }
    const serviceWorkerSelf = self
    // after the offscreen document is created, send a message to it
    const clientsList = await serviceWorkerSelf.clients.matchAll()
    // eslint-disable-next-line id-length
    const client = clientsList.find((c) => c.url.endsWith('offscreen.html'))

    if (client) {
      client.postMessage('https://example.com/')
    } else {
      throw new Error('offscreen document is not found')
    }
  }
}
