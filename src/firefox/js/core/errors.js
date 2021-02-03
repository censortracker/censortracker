const CONNECTION_ERRORS = [
  'NS_ERROR_NET_RESET',
  'NS_BINDING_ABORTED',
  'NS_ERROR_NET_TIMEOUT',
  'NS_ERROR_NET_ON_TRANSACTION_CLOSE',
  'NS_ERROR_NET_ON_TLS_HANDSHAKE_ENDED',
]

const PROXY_CONNECTION_ERRORS = [
  'NS_ERROR_UNKNOWN_PROXY_HOST',
  'NS_ERROR_PROXY_CONNECTION_REFUSED',
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
