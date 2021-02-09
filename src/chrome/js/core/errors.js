const CONNECTION_ERRORS = [
  'net::ERR_CONNECTION_RESET',
  'net::ERR_CONNECTION_TIMED_OUT',
]

const PROXY_CONNECTION_ERRORS = [
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
