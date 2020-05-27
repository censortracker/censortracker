(function () {
  class BrowserSession {
    constructor () {
      this.requests = new Map()
    }

    putRequest (requestId, key, value) {
      if (!this.requests.has(requestId)) {
        this.requests.set(requestId, {})
      }
      this.requests.get(requestId)[key] = value
    }

    getRequest (requestId, key, defaultValue) {
      if (this.requests.has(requestId) && key in this.requests.get(requestId)) {
        return this.requests.get(requestId)[key]
      }
      return defaultValue
    }

    deleteRequest (requestId) {
      if (this.requests.has(requestId)) {
        this.requests.delete(requestId)
      }
    }
  }

  window.browserSession = new BrowserSession()
})()
