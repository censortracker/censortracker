const API_URL = 'http://localhost:49490/api/v1'

/**
 * ProxyClient handles API communication with the proxy server.
 */
class ProxyClient {
  /**
   * Sends an HTTP request to the API.
   * @param {string} method - HTTP method (GET, POST, etc.).
   * @param {string} endpoint - API endpoint path.
   * @param {Object|null} [body=null] - Request payload.
   * @returns {Promise<Object>} - Parsed JSON response.
   */
  async request (method, endpoint, body = null) {
    const url = `${API_URL}${endpoint}`
    const options = {
      method,
      headers: { 'Content-Type': 'application/json' },
      ...(body && { body: JSON.stringify(body) }),
    }

    try {
      const response = await fetch(url, options)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || `HTTP error: ${response.status}`)
      }
      return data
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
   * @returns {Promise<Object|null>} - API response or null on failure.
   */
  async handleRequest (method, endpoint, body = null, successCallback = null) {
    try {
      const data = await this.request(method, endpoint, body)

      return successCallback ? successCallback(data) : data
    } catch {
      return null
    }
  }

  /**
   * Retrieves proxy configuration(s).
   * @param {string} [uuids=''] - Comma-separated UUIDs of configurations.
   * @returns {Promise<Object[]>} - List of configurations.
   */
  async getConfig (uuids = '') {
    return this.handleRequest(
      'GET',
      `/config?uuid=${encodeURIComponent(uuids)}`,
      null,
      (data) => data || {},
    )
  }

  /**
   * Adds a new proxy configuration.
   * @param {Object[]} configs - Array of configuration objects.
   * @returns {Promise<boolean>} - True if successful, otherwise false.
   */
  async setConfig (configs) {
    return this.handleRequest(
      'POST',
      '/config',
      configs,
      (data) => data.status === 'success',
    )
  }

  /**
   * Updates existing proxy configurations.
   * @param {Object[]} configs - Array of updated configurations.
   * @returns {Promise<boolean>} - True if successful, otherwise false.
   */
  async updateConfig (configs) {
    return this.handleRequest(
      'PUT',
      '/config',
      configs,
      (data) => data.status === 'success',
    )
  }

  /**
   * Deletes a proxy configuration by UUID.
   * @param {string} uuid - UUID of the configuration to delete.
   * @returns {Promise<boolean>} - True if successful, otherwise false.
   */
  async deleteConfig (uuid) {
    return this.handleRequest(
      'DELETE',
      `/config/${encodeURIComponent(uuid)}`,
      null,
      (data) => data.status === 'success',
    )
  }

  /**
   * Activates a proxy configuration by UUID.
   * @param {string} uuid - UUID of the configuration to activate.
   * @returns {Promise<boolean>} - True if successful, otherwise false.
   */
  async activateConfig (uuid) {
    return this.handleRequest(
      'PUT',
      `/config/activate/${encodeURIComponent(uuid)}`,
      null,
      (data) => data.status === 'success',
    )
  }

  /**
   * Retrieves the active proxy configuration.
   * @returns {Promise<Object|null>} - Active configuration or null if not found.
   */
  async getActiveConfig () {
    return this.handleRequest(
      'GET',
      '/config/active',
      null,
      (data) => data.config || null,
    )
  }

  /**
   * Starts the proxy server.
   * @returns {Promise<number|null>} - Proxy server port if successful, otherwise null.
   */
  async startProxy () {
    return this.handleRequest(
      'POST',
      '/up',
      null,
      (data) => data.xray_port || null,
    )
  }

  /**
   * Stops the proxy server.
   * @returns {Promise<boolean>} - True if successful.
   */
  async stopProxy () {
    return this.handleRequest('POST', '/down', null, () => true)
  }

  /**
   * Checks if the proxy server is running.
   * @returns {Promise<Object>} - True if running, otherwise false.
   */
  async ping () {
    return this.handleRequest('GET', '/ping', null, (data) => {
      return data
    })
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
}

export default new ProxyClient()
