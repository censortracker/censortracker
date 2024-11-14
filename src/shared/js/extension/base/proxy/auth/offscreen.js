const myWorker = new Worker('auth-worker.js')

navigator.serviceWorker.addEventListener('message', (e) => {
  console.log(`offscreen document received message: ${e.data}`)
  myWorker.postMessage(e.data)
})
