import errors from '../../src/chrome/js/core/errors'

const ERR_CONNECTION_RESET = 'net::ERR_CONNECTION_RESET'
const ERR_CERT_AUTHORITY_INVALID = 'net::ERR_CERT_AUTHORITY_INVALID'
const ERR_CONNECTION_TIMED_OUT = 'net::ERR_CONNECTION_TIMED_OUT'
const ERR_TUNNEL_CONNECTION_FAILED = 'net::ERR_TUNNEL_CONNECTION_FAILED'
const ERR_PROXY_CONNECTION_FAILED = 'net::ERR_PROXY_CONNECTION_FAILED'

describe('check that the type of error is ProxyConnectionError', () => {
  const proxyErrors = [
    { error: ERR_TUNNEL_CONNECTION_FAILED, expected: true },
    { error: ERR_PROXY_CONNECTION_FAILED, expected: true },
    { error: ERR_CERT_AUTHORITY_INVALID, expected: false },
  ]

  test.each(proxyErrors)('returns true when the error code matches the specified', ({ error, expected }) => {
    const isThereError = errors.isThereProxyConnectionError(error)

    if (expected) {
      expect(isThereError).toBeTruthy()
    } else {
      expect(isThereError).toBeFalsy()
    }
  })
})

describe('check that the type of error is ConnectionError', () => {
  const availabilityErrors = [
    { error: ERR_CONNECTION_RESET, expected: true },
    { error: ERR_CONNECTION_TIMED_OUT, expected: true },
    { error: ERR_PROXY_CONNECTION_FAILED, expected: false },
  ]

  test.each(availabilityErrors)('returns true when the error code matches the specified', ({ error, expected }) => {
    const isThereError = errors.isThereConnectionError(error)

    if (expected) {
      expect(isThereError).toBeTruthy()
    } else {
      expect(isThereError).toBeFalsy()
    }
  })
})
