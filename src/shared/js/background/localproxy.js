import axios from 'axios'
import browser from 'Background/browser-api'

/**
 * ProxyClient handles API communication with the proxy server.
 */
class ProxyClient {
  /**
   * Sends an HTTP request to the API using axios.
   * @param {string} method - HTTP method (GET, POST, etc.).
   * @param {string} endpoint - API endpoint path.
   * @param {Object|null} [body=null] - Request payload.
   * @param {number} [timeout=2500] - Request timeout in milliseconds.
   * @returns {Promise<Object>} - Parsed JSON response.
   */
  async request (method, endpoint, body = null, timeout = 3500) {
    const url = `http://localhost:49490/api/v1${endpoint}`
    const options = {
      method,
      url,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout,
      ...(body && { data: body }),
    }

    try {
      const response = await axios(options)

      return response.data
    } catch (error) {
      console.error(
        `[ProxyClient] Request failed: ${method} ${url} - ${error.message}`,
      )
      throw error
    }
  }

  /**
   * Handles API request with optional success callback.
   * @param {string} method - HTTP method.
   * @param {string} endpoint - API endpoint.
   * @param {Object|null} [body=null] - Request payload.
   * @param {Function|null} [successCallback=null] - Callback executed on success.
   * @param {number} [timeout=2500] - Request timeout in milliseconds.
   * @returns {Promise<Object|null>} - API response or null on failure.
   */
  async handleRequest (
    method,
    endpoint,
    body = null,
    successCallback = null,
    timeout = 3500,
  ) {
    try {
      console.log(`${method} ${endpoint}`)
      const data = await this.request(method, endpoint, body, timeout)

      return successCallback ? successCallback(data) : data
    } catch {
      console.error(`[ProxyClient]: ${method} ${endpoint}`)
      return successCallback({})
    }
  }

  /**
   * Starts the proxy server.
   * @param {number} [timeout=3000] - Request timeout in milliseconds.
   * @returns {Promise<number|null>} - Proxy port or null on failure.
   */
  async start (timeout = 3000) {
    console.log('Starting local proxy...')
    const { status, proxyPort } = this.handleRequest(
      'POST',
      '/up',
      null,
      (data) => data,
      timeout,
    )

    if (status === 'ok') {
      return proxyPort
    }
    return null
  }

  /**
   * Stops the proxy server.
   * @param {number} [timeout=3000] - Request timeout in milliseconds.
   * @returns {Promise<boolean>} - Response from the API.
   */
  async stop (timeout = 3000) {
    const { status } = this.handleRequest(
      'POST',
      '/down',
      null,
      (data) => data,
      timeout,
    )

    return status === 'ok'
  }

  /**
   * Checks if the proxy server is running.
   * @param {number} [timeout=1500] - Request timeout in milliseconds.
   * @returns {Promise<number|null>} - Proxy port or null if not running.
   */
  async ping (timeout = 1500) {
    const { status, proxyPort } = this.handleRequest(
      'GET',
      '/ping',
      null,
      (data) => data,
      timeout,
    )

    if (status === 'ok') {
      return proxyPort
    }
    return null
  }

  async setLocalProxyURI (port) {
    let defaultPort = '10808'

    if (port && port !== defaultPort) {
      defaultPort = port
    }

    const localProxyURI = `127.0.0.1:${defaultPort}`

    await browser.storage.local.set({ localProxyURI })
  }
}

export default new ProxyClient()
