import errors from '../../src/chrome/js/core/errors'

const ERR_CONNECTION_RESET = 'ERR_CONNECTION_RESET'
const ERR_CONNECTION_CLOSED = 'ERR_CONNECTION_CLOSED'
const ERR_CERT_COMMON_NAME_INVALID = 'ERR_CERT_COMMON_NAME_INVALID'
const ERR_HTTP2_PROTOCOL_ERROR = 'ERR_HTTP2_PROTOCOL_ERROR'
const ERR_CERT_AUTHORITY_INVALID = 'ERR_CERT_AUTHORITY_INVALID'
const ERR_CONNECTION_TIMED_OUT = 'ERR_CONNECTION_TIMED_OUT'
const ERR_TUNNEL_CONNECTION_FAILED = 'ERR_TUNNEL_CONNECTION_FAILED'
const ERR_PROXY_CONNECTION_FAILED = 'ERR_PROXY_CONNECTION_FAILED'

describe('check that the type of error is AvailabilityError', () => {
  const availabilityErrors = [
    { error: ERR_HTTP2_PROTOCOL_ERROR, expected: true },
    { error: ERR_CERT_AUTHORITY_INVALID, expected: false },
  ]

  test.each(availabilityErrors)('returns true when the error code matches the specified', ({ error, expected }) => {
    const isThereError = errors.isThereAvailabilityError(error)

    if (expected) {
      expect(isThereError).toBeTruthy()
    } else {
      expect(isThereError).toBeFalsy()
    }
  })
})

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

describe('check that the type of error is CertificateError', () => {
  const availabilityErrors = [
    { error: ERR_CERT_AUTHORITY_INVALID, expected: true },
    { error: ERR_CERT_COMMON_NAME_INVALID, expected: true },
    { error: ERR_PROXY_CONNECTION_FAILED, expected: false },
  ]

  test.each(availabilityErrors)('returns true when the error code matches the specified', ({ error, expected }) => {
    const isThereError = errors.isThereCertificateError(error)

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
    { error: ERR_CONNECTION_CLOSED, expected: true },
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
