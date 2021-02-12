const CONNECTION_ERRORS = [
  // Firefox
  'NS_ERROR_NET_RESET',
  'NS_BINDING_ABORTED',
  'NS_ERROR_NET_TIMEOUT',
  'NS_ERROR_NET_ON_TRANSACTION_CLOSE',
  'NS_ERROR_NET_ON_TLS_HANDSHAKE_ENDED',

  // Chromium
  'net::ERR_CONNECTION_RESET',
  'net::ERR_CONNECTION_TIMED_OUT',
]

const PROXY_CONNECTION_ERRORS = [
  // Firefox
  'NS_ERROR_UNKNOWN_PROXY_HOST',
  'NS_ERROR_PROXY_CONNECTION_REFUSED',

  // Chromium
  'net::ERR_TUNNEL_CONNECTION_FAILED',
  'net::ERR_PROXY_CONNECTION_FAILED',
  'net::ERR_PROXY_CERTIFICATE_INVALID',
]

class Errors {
  determineError = (error) => {
    if (PROXY_CONNECTION_ERRORS.includes(error)) {
      return { proxyError: true }
    }
    if (CONNECTION_ERRORS.includes(error)) {
      return { connectionError: true }
    }
    return { unknownError: true }
  }
}

export default new Errors()
