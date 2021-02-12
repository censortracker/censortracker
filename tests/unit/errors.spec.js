// import errors from 'src/common/js/errors'
//
// // TODO: Add checks for Firefox
// const ERR_CONNECTION_RESET = 'net::ERR_CONNECTION_RESET'
// const ERR_CERT_AUTHORITY_INVALID = 'net::ERR_CERT_AUTHORITY_INVALID'
// const ERR_CONNECTION_TIMED_OUT = 'net::ERR_CONNECTION_TIMED_OUT'
// const ERR_TUNNEL_CONNECTION_FAILED = 'net::ERR_TUNNEL_CONNECTION_FAILED'
// const ERR_PROXY_CONNECTION_FAILED = 'net::ERR_PROXY_CONNECTION_FAILED'
//
// describe('check that the type of error is proxy error', () => {
//   const proxyErrors = [
//     { error: ERR_TUNNEL_CONNECTION_FAILED, expected: true },
//     { error: ERR_PROXY_CONNECTION_FAILED, expected: true },
//     { error: ERR_CERT_AUTHORITY_INVALID, expected: undefined },
//   ]
//
//   test.each(proxyErrors)('returns true when the error code matches the specified', ({ error, expected }) => {
//     const { proxyError } = errors.determineError(error)
//
//     expect(proxyError).toBe(expected)
//   })
// })
//
// describe('check that the type of error is connection error', () => {
//   const availabilityErrors = [
//     { error: ERR_CONNECTION_RESET, expected: true },
//     { error: ERR_CONNECTION_TIMED_OUT, expected: true },
//     { error: ERR_PROXY_CONNECTION_FAILED, expected: undefined },
//   ]
//
//   test.each(availabilityErrors)('returns true when the error code matches the specified', ({ error, expected }) => {
//     const { connectionError } = errors.determineError(error)
//
//     expect(connectionError).toBe(expected)
//   })
// })
