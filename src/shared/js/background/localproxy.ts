import axios from 'axios'

import { isConsentError, withDataConsent } from './data-consent'
import { errorMessage } from './value'

interface LocalProxyResponse { status?: string; proxyPort?: number }

const validPort = (port: unknown): port is number => typeof port === 'number' &&
  Number.isInteger(port) && port > 0 && port <= 65535

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
  async request (method: string,
    endpoint: string,
    body: Record<string,
      unknown> | null = null,
    timeout = 3500) {
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
      const response = await withDataConsent((signal) =>
        axios<LocalProxyResponse>({ ...options, signal }))

      return response.data
    } catch (error) {
      console.error(
        `[ProxyClient] Request failed: ${method} ${url} - ${errorMessage(error)}`,
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
  async handleRequest (method: string,
    endpoint: string,
    body: Record<string,
      unknown> | null,
    successCallback: (data: LocalProxyResponse) => LocalProxyResponse,
    timeout?: number): Promise<LocalProxyResponse>
  async handleRequest (method: string,
    endpoint: string,
    body?: Record<string,
      unknown> | null,
    successCallback?: null,
    timeout?: number): Promise<LocalProxyResponse | null>
  async handleRequest (
    method: string,
    endpoint: string,
    body: Record<string, unknown> | null = null,
    successCallback:
      ((data: LocalProxyResponse) => LocalProxyResponse) | null = null,

    timeout = 3500,
  ) {
    try {
      console.log(`${method} ${endpoint}`)
      const data = await this.request(method, endpoint, body, timeout)

      console.log(`${method} ${endpoint}: ${JSON.stringify(data)}`)

      return successCallback ? successCallback(data) : data
    } catch (error) {
      if (isConsentError(error)) {
        throw error
      }
      console.error(`[ProxyClient]: ${method} ${endpoint}`)
      return successCallback ? successCallback({}) : null
    }
  }

  /**
   * Starts the proxy server.
   * @param {number} [timeout=3000] - Request timeout in milliseconds.
   * @returns {Promise<number|null>} - Proxy port or null on failure.
   */
  async start (timeout = 3000) {
    console.log('Starting local proxy...')
    const { status, proxyPort } = await this.handleRequest(
      'POST',
      '/up',
      null,
      (data) => data || {},
      timeout,
    )

    if (status === 'ok' && validPort(proxyPort)) {
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
    const { status } = await this.handleRequest(
      'POST',
      '/down',
      null,
      (data) => data || {},
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
    const { status, proxyPort } = await this.handleRequest(
      'GET',
      '/ping',
      null,
      (data) => data || {},
      timeout,
    )

    if (status === 'ok' && validPort(proxyPort)) {
      return proxyPort
    }
    return null
  }
}

export default new ProxyClient()
