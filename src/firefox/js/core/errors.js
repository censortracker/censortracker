const NS_ERROR_NET_RESET = 'NS_ERROR_NET_RESET'
const NS_ERROR_NET_TIMEOUT = 'NS_ERROR_NET_TIMEOUT'
const NS_BINDING_ABORTED = 'NS_BINDING_ABORTED'
const NS_ERROR_PROXY_CONNECTION_REFUSED = 'NS_ERROR_PROXY_CONNECTION_REFUSED'
const NS_ERROR_PROXY_INVALID_IN_PARAMETER = 'NS_ERROR_PROXY_INVALID_IN_PARAMETER'
const NS_ERROR_PROXY_INVALID_OUT_PARAMETER = 'NS_ERROR_PROXY_INVALID_OUT_PARAMETER'
const NS_ERROR_UNKNOWN_PROXY_HOST = 'NS_ERROR_UNKNOWN_PROXY_HOST'
const NS_ERROR_NET_ON_TRANSACTION_CLOSE = 'NS_ERROR_NET_ON_TRANSACTION_CLOSE'
const NS_ERROR_NET_ON_TLS_HANDSHAKE_ENDED = 'NS_ERROR_NET_ON_TLS_HANDSHAKE_ENDED'

class Errors {
  isThereProxyConnectionError = (error) => [
    NS_ERROR_PROXY_CONNECTION_REFUSED,
    NS_ERROR_PROXY_INVALID_IN_PARAMETER,
    NS_ERROR_PROXY_INVALID_OUT_PARAMETER,
    NS_ERROR_UNKNOWN_PROXY_HOST,
  ].includes(error)

  isThereConnectionError = (error) => [
    NS_ERROR_NET_RESET,
    NS_BINDING_ABORTED,
    NS_ERROR_NET_TIMEOUT,
    NS_ERROR_NET_ON_TRANSACTION_CLOSE,
    NS_ERROR_NET_ON_TLS_HANDSHAKE_ENDED,
  ].includes(error)
}

export default new Errors()
