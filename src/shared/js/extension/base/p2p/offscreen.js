const myWorker = new Worker('p2p-worker.js', { type: 'module' })

const BROKER_URL = 'ws://77.232.138.31:8080'

let ws = null
let peerConnection = null
let dataChannel = null

const openWebSocket = () => {
  ws = new WebSocket(BROKER_URL)
  peerConnection = new RTCPeerConnection()

  ws.addEventListener('message', async (event) => {
    const data = await event.data.text()

    console.log(data)
    if (data.includes('v=0')) {
      const desc = new RTCSessionDescription({ type: 'offer', sdp: data })

      await peerConnection.setRemoteDescription(desc)
      const answer = await peerConnection.createAnswer()

      await peerConnection.setLocalDescription(answer)
      ws.send(peerConnection.localDescription.sdp)
    } else if (data.includes('candidate')) {
      const candidate = new RTCIceCandidate({ candidate: data })

      await peerConnection.addIceCandidate(candidate)
    }
  })

  peerConnection.onicecandidate = ({ candidate }) => {
    if (candidate) {
      ws.send(candidate.candidate)
    }
  }

  peerConnection.ondatachannel = async (event) => {
    const channel = event.channel

    channel.addEventListener('message', async (e) => {
      const requestData = JSON.parse(e.data)

      console.log('Message from Python:', JSON.parse(e.data))
      const response = await fetch(
        `${requestData.scheme}://${requestData.host}${requestData.path}`, {
          method: requestData.method,
          headers: requestData.headers,
        },
      )

      const headersObj = {}

      response.headers.forEach((value, key) => {
        headersObj[key] = value
      })

      let bodyText = ''

      if (response.body) {
        const reader = response.body.getReader()
        const chunks = []

        let done, value

        // eslint-disable-next-line no-cond-assign
        while ({ done, value } = await reader.read()) {
          if (done) {
            break
          }
          chunks.push(value)
        }

        const responseBody = new Uint8Array(chunks.reduce((acc, chunk) => acc.concat(Array.from(chunk)), []))

        bodyText = new TextDecoder().decode(responseBody)
      }

      const responseObject = {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        redirected: response.redirected,
        ok: response.ok,
        headers: headersObj,
        body: bodyText,
      }

      console.log('Response:', responseObject)
      channel.send(JSON.stringify(responseObject))
    })
  }

  dataChannel = peerConnection.createDataChannel('chat')
  dataChannel.addEventListener('open', () => console.log('Data channel opened!'))
}

navigator.serviceWorker.addEventListener('message', (e) => {
  console.log(`offscreen document received message: ${e.data}`)
  myWorker.postMessage(e.data)
  openWebSocket()
})
