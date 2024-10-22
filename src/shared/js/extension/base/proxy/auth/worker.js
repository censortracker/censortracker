/**
 * Worker receives url from the offscreen document and fetches it.
 * For more details on this worker read ProxyAuthTrigger.
 * @param e Message event
 */
onmessage = (e) => {
  console.log(`worker created by offscreen document received: ${e.data}`)
  fetch(e.data)
    .then(() => {
      console.log('url fetched successfully')
    })
    .catch((error) => {
      console.log(`during fetching: ${e.data}, error occurred: ${error}`)
    })
}
