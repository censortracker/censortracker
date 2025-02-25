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
   * Retrieves proxy configuration(s).
   * @param {string} [uuids=''] - Comma-separated UUIDs of configurations.
   * @param {number} [timeout=2500] - Request timeout in milliseconds.
   * @returns {Promise<Object>} - List of configurations.
   */
  async getConfig (uuids = '', timeout = 2500) {
    return this.handleRequest(
      'GET',
      `/configs?uuid=${encodeURIComponent(uuids)}`,
      null,
      (data) => data,
      timeout,
    )
  }

  /**
   * Adds a new proxy configuration.
   * @param {Object[]} configs - Array of configuration objects.
   * @param {number} [timeout=2500] - Request timeout in milliseconds.
   * @returns {Promise<boolean>} - True if successful, otherwise false.
   */
  async setConfig (configs, timeout = 5000) {
    return this.handleRequest(
      'POST',
      '/configs',
      configs,
      (data) => data,
      timeout,
    )
  }

  /**
   * Deletes a proxy configuration by UUID.
   * @param {string} uuid - UUID of the configuration to delete.
   * @param {number} [timeout=3000] - Request timeout in milliseconds.
   * @returns {Promise<boolean>} - True if successful, otherwise false.
   */
  async deleteConfig (uuid, timeout = 3000) {
    return this.handleRequest(
      'DELETE',
      `/configs?uuid=${uuid}`,
      null,
      (data) => data,
      timeout,
    )
  }

  /**
   * Activates a proxy configuration by UUID.
   * @param {string} uuid - UUID of the configuration to activate.
   * @param {number} [timeout=5000] - Request timeout in milliseconds.
   * @returns {Promise<boolean>} - True if successful, otherwise false.
   */
  async activateConfig (uuid, timeout = 5000) {
    return this.handleRequest(
      'PUT',
      `/configs/activate?uuid=${uuid}`,
      null,
      (data) => data,
      timeout,
    )
  }

  /**
   * Retrieves the active proxy configuration.
   * @param {number} [timeout=2500] - Request timeout in milliseconds.
   * @returns {Promise<Object|null>} - Active configuration or null if not found.
   */
  async getActiveConfig (timeout = 2500) {
    return this.handleRequest(
      'GET',
      '/configs/active',
      null,
      (data) => data,
      timeout,
    )
  }

  /**
   * Starts the proxy server.
   * @param {number} [timeout=3000] - Request timeout in milliseconds.
   * @returns {Promise<number|null>} - Proxy server port if successful, otherwise null.
   */
  async start (timeout = 3000) {
    console.log('Starting local proxy...')
    return this.handleRequest(
      'POST',
      '/up',
      null,
      (data) => data,
      timeout,
    )
  }

  /**
   * Stops the proxy server.
   * @param {number} [timeout=3000] - Request timeout in milliseconds.
   * @returns {Promise<Object>} - Response from the API.
   */
  async stop (timeout = 3000) {
    return this.handleRequest(
      'POST',
      '/down',
      null,
      (data) => data,
      timeout,
    )
  }

  /**
   * Checks if the proxy server is running.
   * @param {number} [timeout=1500] - Request timeout in milliseconds.
   * @returns {Promise<Object>} - API response.
   */
  async ping (timeout = 1500) {
    return this.handleRequest(
      'GET',
      '/ping',
      null,
      (data) => data,
      timeout,
    )
  }

  /**
   * Validates a proxy configuration URI.
   * @param {string} configUri - Proxy configuration URI.
   * @returns {boolean} - True if valid, otherwise false.
   */
  validateConfig (configUri) {
    if (!/^(vmess|vless|ss):\/\//.test(configUri)) {
      return false
    }
    if (configUri.startsWith('vmess://')) {
      try {
        window.atob(configUri.split('://')[1])
        return true
      } catch {
        return false
      }
    }
    return true
  }

  /**
   * Parses the Xray configuration from a URL.
   * @param url - Subscription URL.
   * @returns {Promise<string[]|*[]>}
   */
  async parseConfig (url) {
    if (!url) {
      return []
    }

    if (url.startsWith('https://')) {
      try {
        const response = await fetch(url)
        const responseText = await response.text()
        const textConfigs = window.atob(responseText)

        return textConfigs
          .split('\n')
          .filter((config) => config.trim())
      } catch (error) {
        return []
      }
    } else if (this.validateConfig(url)) {
      return [url]
    }
    return []
  }

  async setLocalProxyURI () {
    const localProxyURI = '127.0.0.1:10808'

    await browser.storage.local.set({ localProxyURI })
  }
}

export default new ProxyClient()
