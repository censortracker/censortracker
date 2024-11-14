import browser from '../../../browser-api'
import configManager from '../config'

export const isEnabled = async () => {
  const { bridgeModeEnabled } = await configManager.get('bridgeModeEnabled')
  // TODO: send a message to an offscreen worker to get a connection status

  return bridgeModeEnabled
}

const createOffScreenDocument = (() => {
  let creating

  return async () => {
    if (creating) {
      await creating
    } else {
      creating = browser.offscreen.createDocument({
        url: 'p2p-offscreen.html',
        reasons: [browser.offscreen.Reason.WORKERS],
        justification: 'needed to run as p2p bridge',
      })
      await creating
      creating = null
    }
  }
})()

export const enable = async () => {
  await configManager.set({ bridgeModeEnabled: true })
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
  const client = clientsList.find((c) => c.url.endsWith('p2p-offscreen.html'))

  if (client) {
    client.postMessage('enableBridgeMode')
  } else {
    throw new Error('offscreen document is not found')
  }
}

export const disable = async () => {
  await configManager.set({ bridgeModeEnabled: false })
  // TODO: send a message to an offscreen worker to close the connection
}
