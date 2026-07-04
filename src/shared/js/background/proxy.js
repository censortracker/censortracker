import { getPacScript } from 'Background/pac'

import browser from './browser-api'
import {
  DEFAULT_PROXY_TEST_TARGET,
  EXIT_INFO_POOL,
  PROXY_TEST_POOL,
  PROXY_TEST_TARGETS,
  TaskType,
} from './constants'
import { lookupCountries, parseExitInfo } from './geoip'
import registry from './registry'
import {
  fetchWithTimeout,
  parseProxyList,
  proxyToPacToken,
} from './utilities'

class ProxyManager {
  async getProxyingRules () {
    const {
      proxyServerURI,
      customProxyProtocol,
      customProxyServerURI,
      localProxyURI,
    } = await browser.storage.local.get([
      'proxyServerURI',
      'customProxyProtocol',
      'customProxyServerURI',
      'localProxyURI',
    ])

    // When Censor Tracker Proxy Server is used
    if (localProxyURI) {
      console.log(`Using local proxy server: ${localProxyURI}`)
      return {
        proxyServerProtocol: 'SOCKS5',
        proxyServerURI: localProxyURI,
      }
    }

    if (
      customProxyServerURI &&
      customProxyProtocol
    ) {
      return {
        proxyServerProtocol: customProxyProtocol,
        proxyServerURI: customProxyServerURI,
      }
    }
    return {
      proxyServerProtocol: 'HTTPS',
      proxyServerURI,
    }
  }

  async requestIncognitoAccess () {
    if (browser.isFirefox) {
      const isAllowedIncognitoAccess =
        await browser.extension.isAllowedIncognitoAccess()

      if (!isAllowedIncognitoAccess) {
        await browser.browserAction.setBadgeText({ text: '✕' })
        await browser.storage.local.set({
          privateBrowsingPermissionsRequired: true,
        })
        console.info('Private browsing permissions requested.')
      }
    }
  }

  async grantIncognitoAccess () {
    if (browser.isFirefox) {
      await browser.browserAction.setBadgeText({ text: '' })
      await browser.storage.local.set({
        privateBrowsingPermissionsRequired: false,
      })
    }
  }

  /**
   * Pushes a raw PAC script into the browser proxy settings, normalizing the
   * call shape across Firefox (autoConfig blob) and Chromium (pac_script).
   * @param {string} pacData - PAC script source.
   * @param {object} [options]
   * @param {boolean} [options.mandatory=false] - On Chromium, when true a proxy
   *   that can't be reached is NOT silently bypassed with a direct connection.
   *   The checker needs this so a dead proxy fails the probe instead of falling
   *   through to DIRECT and looking alive.
   * @returns {Promise<void>}
   */
  async applyPacData (pacData, { mandatory = false } = {}) {
    const config = {}

    if (browser.isFirefox) {
      const blob = new Blob([pacData], {
        type: 'application/x-ns-proxy-autoconfig',
      })

      // Revoke the previous PAC object URL so repeated checker updates don't
      // leak object URLs.
      if (this._lastPacObjectUrl) {
        URL.revokeObjectURL(this._lastPacObjectUrl)
      }
      this._lastPacObjectUrl = URL.createObjectURL(blob)

      config.value = {
        proxyType: 'autoConfig',
        autoConfigUrl: this._lastPacObjectUrl,
      }
    } else {
      config.scope = 'regular'
      config.value = {
        mode: 'pac_script',
        pacScript: {
          data: pacData,
          mandatory,
        },
      }
    }
    await browser.proxy.settings.set(config)
  }

  /**
   * Installs a temporary PAC used while checking proxies. Everything keeps
   * routing exactly as it does for the user right now (so browsing never drops
   * mid-check) except the hosts named in `testRoutes`, which are sent through
   * the proxy currently being tested. Applied as mandatory so a dead candidate
   * fails the probe instead of leaking to DIRECT.
   * @param {Object<string, string>} testRoutes - host -> PAC return token.
   * @returns {Promise<void>}
   */
  async applyCheckerPac (testRoutes) {
    const enabled = await this.isEnabled()

    let domains = []
    let proxies = []
    let proxyServerURI = ''
    let proxyServerProtocol = 'HTTPS'
    let proxyAll = false

    // Preserve the user's real routing only when proxying is actually on;
    // otherwise non-test traffic must stay DIRECT just like it is now.
    if (enabled) {
      domains = await registry.getDomains()
      proxyAll = await this.getProxyAllTraffic()
      const chain = await this.getChainProxyConfigs()

      if (chain.length > 0) {
        proxies = chain
      } else {
        const rules = await this.getProxyingRules()

        proxyServerURI = rules.proxyServerURI
        proxyServerProtocol = rules.proxyServerProtocol
      }
    }

    const pacData = getPacScript({
      domains,
      proxies,
      proxyServerURI,
      proxyServerProtocol,
      testRoutes,
      proxyAll,
    })

    await this.applyPacData(pacData, { mandatory: true })
  }

  async setProxy () {
    const domains = await registry.getDomains()
    const proxyAll = await this.getProxyAllTraffic()

    // Without proxy-all, an empty domain list means there is nothing to
    // route; with it, the PAC proxies everything regardless of the list.
    if (domains.length === 0 && !proxyAll) {
      console.error('No domains to proxy, aborting...')
      await this.removeProxy()
      return false
    }

    // A proxy chain (one or more marked proxies, tried one after another)
    // takes precedence; otherwise fall back to the single default/built-in
    // proxy resolved from the legacy rules.
    const chain = await this.getChainProxyConfigs()

    let pacData

    if (chain.length > 0) {
      pacData = getPacScript({ domains, proxies: chain, proxyAll })
    } else {
      const {
        proxyServerURI,
        proxyServerProtocol,
      } = await this.getProxyingRules()

      pacData = getPacScript({
        domains,
        proxyServerURI,
        proxyServerProtocol,
        proxyAll,
      })
    }

    try {
      await this.applyPacData(pacData)
      await this.enableProxy()
      await this.grantIncognitoAccess()
      console.warn('PAC has been set successfully!')
      return true
    } catch (error) {
      console.error(`PAC could not be set: ${error}`)
      await this.disableProxy()
      await this.requestIncognitoAccess()
      return false
    }
  }

  /**
   * Restores the user's real proxy configuration after a temporary probe PAC.
   * @returns {Promise<void>}
   */
  async restoreProxy () {
    if (await this.isEnabled()) {
      await this.setProxy()
    } else {
      await this.removeProxy()
    }
  }

  async removeProxy () {
    try {
      await browser.proxy.settings.clear({})
      console.warn('Proxy settings removed.')
    } catch (error) {
      console.error(`Failed to clear proxy settings: ${error}`)
    }
  }

  async alive () {
    const { proxyIsAlive } =
      await browser.storage.local.get({ proxyIsAlive: true })

    return proxyIsAlive
  }

  async ping () {
    const usingCustomProxy = await this.usingCustomProxy()

    if (!usingCustomProxy) {
      const { proxyPingURI } = await browser.storage.local.get('proxyPingURI')

      if (!proxyPingURI) {
        return
      }

      // Bounded by a timeout so a dead proxy can never keep the request
      // (and any task awaiting it) hanging indefinitely.
      fetchWithTimeout(`https://${proxyPingURI}`, {
        method: 'POST',
        timeout: 5000,
        headers: {
          'Content-type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          type: 'ping',
        }),
      }).catch(() => {
        // We don't care about the result of the warm-up ping.
        console.log(`Pinged ${proxyPingURI}!`)
      })
    }
  }

  async usingCustomProxy () {
    const { useOwnProxy } =
      await browser.storage.local.get({
        useOwnProxy: false,
      })

    return useOwnProxy
  }

  async isEnabled () {
    const { useProxy } = await browser.storage.local.get({ useProxy: true })

    return useProxy
  }

  async enableProxy () {
    console.log('Proxying enabled.')
    await browser.storage.local.set({ useProxy: true, proxyIsAlive: true })
  }

  async disableProxy () {
    console.warn('Proxying disabled.')
    await browser.storage.local.set({ useProxy: false })
  }

  async controlledByOtherExtensions () {
    try {
      const { levelOfControl } = await browser.proxy.settings.get({})

      return levelOfControl === 'controlled_by_other_extensions'
    } catch (error) {
      console.error(`Failed to read proxy level of control: ${error}`)
      return false
    }
  }

  async controlledByThisExtension () {
    try {
      const { levelOfControl } = await browser.proxy.settings.get({})

      return levelOfControl === 'controlled_by_this_extension'
    } catch (error) {
      console.error(`Failed to read proxy level of control: ${error}`)
      return false
    }
  }

  async takeControl () {
    const self = await browser.management.getSelf()
    const extensions = await browser.management.getAll()

    for (const { id, name, permissions } of extensions) {
      if (permissions.includes('proxy') && name !== self.name) {
        console.warn(`Disabling ${name}...`)
        await browser.management.setEnabled(id, false)
      }
    }
  }

  async removeCustomProxy () {
    await browser.storage.local.set({
      useOwnProxy: false,
      activeCustomProxyId: '',
      proxyChain: [],
    })
    await browser.storage.local.remove([
      'customProxyProtocol',
      'customProxyServerURI',
    ])
  }

  generateProxyId () {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID()
    }
    return `p-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  }

  /**
   * Returns the list of user-defined proxy servers. Transparently migrates a
   * legacy single custom proxy into the list on first read.
   * @returns {Promise<Array<{id: string, name: string, protocol: string,
   *   uri: string}>>}
   */
  async getCustomProxies () {
    const {
      customProxies,
      customProxyServerURI,
      customProxyProtocol,
      proxyChain,
    } = await browser.storage.local.get({
      customProxies: [],
      customProxyServerURI: '',
      customProxyProtocol: '',
      proxyChain: null,
    })

    // Migrate ONLY genuinely legacy state (no chain ever stored). Once a
    // chain exists, customProxyServerURI is just a mirror of its first hop
    // (possibly the built-in proxy) — re-importing it here would resurrect a
    // phantom entry every time the list is emptied.
    if (
      customProxies.length === 0 &&
      customProxyServerURI &&
      !Array.isArray(proxyChain)
    ) {
      const migrated = [{
        id: this.generateProxyId(),
        name: customProxyServerURI,
        protocol: customProxyProtocol || 'HTTPS',
        uri: customProxyServerURI,
      }]

      await browser.storage.local.set({
        customProxies: migrated,
        activeCustomProxyId: migrated[0].id,
      })
      return migrated
    }
    return customProxies
  }

  /**
   * Adds a new proxy to the list and makes it the active one.
   * @returns {Promise<{id: string, name: string, protocol: string,
   *   uri: string}>}
   */
  async addCustomProxy ({ name, protocol, uri, credentials = '' }) {
    const customProxies = await this.getCustomProxies()
    const proxy = {
      id: this.generateProxyId(),
      name: (name && name.trim()) || uri,
      protocol,
      uri,
      credentials,
    }

    customProxies.push(proxy)
    await browser.storage.local.set({ customProxies })
    // Adding a proxy appends it to the chain (tried after the existing ones).
    const chain = await this.getProxyChain()

    await this.setProxyChain([...chain, proxy.id])
    return proxy
  }

  /**
   * Adds many proxies at once (e.g. pasted/fetched), skipping ones already in
   * the list (matched by protocol + uri). Does NOT touch the chain, so a bulk
   * import never silently re-routes traffic.
   * @param {Array<{name?: string, protocol: string, uri: string,
   *   credentials?: string}>} list
   * @returns {Promise<Array>} Only the newly-added proxies (with ids).
   */
  async addCustomProxies (list) {
    const customProxies = await this.getCustomProxies()
    const existing = new Set(
      customProxies.map((proxy) => `${proxy.protocol}|${proxy.uri}`.toLowerCase()),
    )
    const added = []

    for (const item of list) {
      if (!item || !item.protocol || !item.uri) {
        continue
      }

      const key = `${item.protocol}|${item.uri}`.toLowerCase()

      if (existing.has(key)) {
        continue
      }
      existing.add(key)

      const proxy = {
        id: this.generateProxyId(),
        name: (item.name && item.name.trim()) || item.uri,
        protocol: item.protocol,
        uri: item.uri,
        credentials: item.credentials || '',
      }

      customProxies.push(proxy)
      added.push(proxy)
    }

    if (added.length > 0) {
      await browser.storage.local.set({ customProxies })
    }
    return added
  }

  /**
   * When true, the PAC routes ALL traffic (except local/private hosts)
   * through the selected proxies, not only the blocked/custom domains.
   * @returns {Promise<boolean>}
   */
  async getProxyAllTraffic () {
    const { proxyAllTraffic } =
      await browser.storage.local.get({ proxyAllTraffic: false })

    return proxyAllTraffic
  }

  async setProxyAllTraffic (value) {
    await browser.storage.local.set({ proxyAllTraffic: !!value })
  }

  async getAutoDeleteDeadProxies () {
    const { autoDeleteDeadProxies } =
      await browser.storage.local.get({ autoDeleteDeadProxies: false })

    return autoDeleteDeadProxies
  }

  async setAutoDeleteDeadProxies (value) {
    await browser.storage.local.set({ autoDeleteDeadProxies: !!value })
  }

  /**
   * Removes a proxy from the list. If it was the active one, falls back to the
   * first remaining proxy (or disables custom proxying if the list is empty).
   * @returns {Promise<Array>} The updated list.
   */
  async deleteCustomProxy (id) {
    const customProxies = await this.getCustomProxies()
    const filtered = customProxies.filter((proxy) => proxy.id !== id)

    await browser.storage.local.set({ customProxies: filtered })
    await this.clearProxyStatus(id)

    // Drop it from the chain too (this also refreshes the mirrored keys or
    // disables custom proxying when the chain becomes empty).
    const chain = await this.getProxyChain()

    if (chain.includes(id)) {
      await this.setProxyChain(chain.filter((chainId) => chainId !== id))
    }
    return filtered
  }

  /**
   * Marks the given proxy as active and mirrors it into the storage keys
   * consumed by {@link getProxyingRules}, so the PAC keeps working unchanged.
   * @returns {Promise<boolean>}
   */
  async setActiveCustomProxy (id) {
    const customProxies = await this.getCustomProxies()
    const proxy = customProxies.find((item) => item.id === id)

    if (!proxy) {
      return false
    }

    // Selecting a single proxy replaces the chain with just that proxy.
    await this.setProxyChain([id])
    return true
  }

  async getActiveCustomProxyId () {
    const { activeCustomProxyId } =
      await browser.storage.local.get({ activeCustomProxyId: '' })

    return activeCustomProxyId
  }

  /**
   * Returns the ordered list of proxy ids that make up the current chain.
   * The browser tries them one after another (failover). Falls back to the
   * legacy single active proxy when no chain has been stored yet.
   * @returns {Promise<Array<string>>}
   */
  async getProxyChain () {
    const { proxyChain, activeCustomProxyId } =
      await browser.storage.local.get({
        proxyChain: null,
        activeCustomProxyId: '',
      })

    if (Array.isArray(proxyChain)) {
      return proxyChain
    }
    return activeCustomProxyId ? [activeCustomProxyId] : []
  }

  /**
   * Stores the proxy chain (ordered ids) and mirrors the first hop into the
   * legacy storage keys read by {@link getProxyingRules}, so the popup and PAC
   * keep working. An empty chain disables custom proxying.
   * @param {Array<string>} ids - Ordered proxy ids ('builtin' is allowed).
   * @returns {Promise<void>}
   */
  async setProxyChain (ids) {
    const chain = Array.isArray(ids) ? ids.filter(Boolean) : []

    await browser.storage.local.set({ proxyChain: chain })

    if (chain.length === 0) {
      await this.removeCustomProxy()
      return
    }

    const customProxies = await this.getCustomProxies()
    const builtin = await this.getBuiltinProxy()
    const firstId = chain[0]
    const first = firstId === 'builtin'
      ? builtin
      : customProxies.find((proxy) => proxy.id === firstId)

    if (first) {
      await browser.storage.local.set({
        useOwnProxy: true,
        activeCustomProxyId: firstId,
        customProxyProtocol: first.protocol,
        customProxyServerURI: first.uri,
      })
    }
  }

  /**
   * Resolves the chain ids into concrete {protocol, uri} pairs for the PAC.
   * Returns an empty array unless the user is on their own proxy, so the
   * default and local-proxy code paths stay untouched.
   * @returns {Promise<Array<{protocol: string, uri: string}>>}
   */
  async getChainProxyConfigs () {
    const { useOwnProxy, localProxyURI } =
      await browser.storage.local.get({ useOwnProxy: false, localProxyURI: '' })

    if (localProxyURI || !useOwnProxy) {
      return []
    }

    const chain = await this.getProxyChain()

    if (chain.length === 0) {
      return []
    }

    const customProxies = await this.getCustomProxies()
    const builtin = await this.getBuiltinProxy()
    const configs = []

    for (const id of chain) {
      if (id === 'builtin') {
        if (builtin) {
          configs.push({ protocol: builtin.protocol, uri: builtin.uri })
        }
      } else {
        const proxy = customProxies.find((item) => item.id === id)

        if (proxy) {
          configs.push({ protocol: proxy.protocol, uri: proxy.uri })
        }
      }
    }
    return configs
  }

  /**
   * Updates an existing proxy in the list. If it is the active one, the
   * mirrored storage keys are refreshed too.
   * @returns {Promise<boolean>}
   */
  async updateCustomProxy (id, { name, protocol, uri, credentials = '' }) {
    const customProxies = await this.getCustomProxies()
    const proxy = customProxies.find((item) => item.id === id)

    if (!proxy) {
      return false
    }

    proxy.name = (name && name.trim()) || uri
    proxy.protocol = protocol
    proxy.uri = uri
    proxy.credentials = credentials

    await browser.storage.local.set({ customProxies })

    const activeId = await this.getActiveCustomProxyId()

    if (activeId === id) {
      await this.setActiveCustomProxy(id)
    }
    return true
  }

  /**
   * Selects the built-in (backend-provided) proxy as the active one in custom
   * mode. Its address is pinned into the custom keys so it keeps being used
   * even if the backend later rotates the default proxy.
   * @returns {Promise<boolean>}
   */
  async setActiveBuiltinProxy () {
    const builtin = await this.getBuiltinProxy()

    if (!builtin) {
      return false
    }

    // Selecting the built-in proxy replaces the chain with just that proxy.
    await this.setProxyChain(['builtin'])
    return true
  }

  /**
   * Returns the currently-active built-in (backend-provided) proxy so it can be
   * imported into the editable list and overridden by the user.
   * @returns {Promise<{protocol: string, uri: string}|null>}
   */
  async getBuiltinProxy () {
    const { proxyServerURI } =
      await browser.storage.local.get({ proxyServerURI: '' })

    if (!proxyServerURI) {
      return null
    }
    return { protocol: 'HTTPS', uri: proxyServerURI }
  }

  // ---------------------------------------------------------------------------
  // Liveness / latency testing
  // ---------------------------------------------------------------------------

  /**
   * Returns the key of the cloud endpoint used to test proxies.
   * @returns {Promise<string>}
   */
  async getProxyTestTarget () {
    const { proxyTestTarget } = await browser.storage.local.get({
      proxyTestTarget: DEFAULT_PROXY_TEST_TARGET,
    })

    return PROXY_TEST_TARGETS[proxyTestTarget]
      ? proxyTestTarget
      : DEFAULT_PROXY_TEST_TARGET
  }

  async setProxyTestTarget (key) {
    if (PROXY_TEST_TARGETS[key]) {
      await browser.storage.local.set({ proxyTestTarget: key })
    }
  }

  /**
   * Last known status per proxy id: { alive, latency, ts }.
   * @returns {Promise<Object>}
   */
  async getProxyStatuses () {
    const { proxyStatuses } =
      await browser.storage.local.get({ proxyStatuses: {} })

    return proxyStatuses
  }

  async setProxyStatus (id, status) {
    if (!id) {
      return
    }
    const proxyStatuses = await this.getProxyStatuses()

    proxyStatuses[id] = { ...status, ts: Date.now() }
    await browser.storage.local.set({ proxyStatuses })
  }

  async clearProxyStatus (id) {
    const proxyStatuses = await this.getProxyStatuses()

    if (id in proxyStatuses) {
      delete proxyStatuses[id]
      await browser.storage.local.set({ proxyStatuses })
    }
  }

  /**
   * Sends one probe request and resolves with whether it reached the endpoint
   * and how long it took. Never throws. Aborts on the shared signal or after
   * `timeout`. Assumes the routing PAC is already in place.
   * @param {string} target - Connectivity endpoint URL.
   * @param {{timeout?: number, signal?: AbortSignal, readBody?: boolean}}
   *   [options] - `readBody` additionally returns the response text (used for
   *   IP-echo endpoints); latency is still measured up to the headers, so
   *   reading the body doesn't skew the timing.
   * @returns {Promise<{ok: boolean, latency: number|null, body: string|null}>}
   */
  async probeUrl (target, { timeout = 8000, signal, readBody = false } = {}) {
    const url = `${target}${target.includes('?') ? '&' : '?'}_ct=${Date.now()}`
    const controller = new AbortController()
    const onAbort = () => controller.abort()

    if (signal) {
      if (signal.aborted) {
        controller.abort()
      } else {
        signal.addEventListener('abort', onAbort, { once: true })
      }
    }

    const timer = setTimeout(() => controller.abort(), timeout)
    const now = () =>
      (typeof performance !== 'undefined' && performance.now)
        ? performance.now()
        : Date.now()
    const started = now()

    try {
      // Any HTTP response means the proxy relayed our request to the cloud.
      const response = await fetch(url, {
        method: 'GET',
        cache: 'no-store',
        redirect: 'manual',
        signal: controller.signal,
      })
      const latency = Math.round(now() - started)
      let body = null

      if (readBody) {
        try {
          body = await response.text()
        } catch (error) {
          // An unreadable body (opaque redirect etc.) is not a failed probe.
        }
      }
      return { ok: true, latency, body }
    } catch (error) {
      return { ok: false, latency: null, body: null }
    } finally {
      clearTimeout(timer)
      if (signal) {
        signal.removeEventListener('abort', onAbort)
      }
    }
  }

  /**
   * Measures the raw round-trip to the proxy server itself: the time until
   * the proxy host answers (or actively refuses) a direct request to its
   * port. No PAC is involved — this is "ping" as opposed to the full
   * open-a-site-through-the-proxy timing measured by {@link probeUrl}. SOCKS
   * and HTTPS proxies reject a plain HTTP request AFTER accepting the TCP
   * connection, so even an error response approximates the network RTT; only
   * a timeout means the host is unreachable.
   * @param {string} uri - "host:port" of the proxy.
   * @param {{timeout?: number, signal?: AbortSignal}} [options]
   * @returns {Promise<number|null>} Milliseconds, or null when unreachable.
   */
  async pingProxyHost (uri, { timeout = 5000, signal } = {}) {
    if (!uri) {
      return null
    }

    const controller = new AbortController()
    const onAbort = () => controller.abort()
    let timedOut = false

    if (signal) {
      if (signal.aborted) {
        return null
      }
      signal.addEventListener('abort', onAbort, { once: true })
    }

    const timer = setTimeout(() => {
      timedOut = true
      controller.abort()
    }, timeout)
    const now = () =>
      (typeof performance !== 'undefined' && performance.now)
        ? performance.now()
        : Date.now()
    const started = now()

    try {
      await fetch(`http://${uri}/`, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        redirect: 'manual',
        signal: controller.signal,
      })
      return Math.round(now() - started)
    } catch (error) {
      if (timedOut || (signal && signal.aborted)) {
        return null
      }
      // The host answered with a refusal/protocol error — that's still a
      // round-trip.
      return Math.round(now() - started)
    } finally {
      clearTimeout(timer)
      if (signal) {
        signal.removeEventListener('abort', onAbort)
      }
    }
  }

  /**
   * Probes the exit of a proxy: fetches an IP-echo endpoint through it (the
   * PAC route must already be in place) and parses the echoed address and,
   * when reported, country. Never throws.
   * @param {string} exitTarget - IP-echo endpoint URL routed via the proxy.
   * @param {{timeout?: number, signal?: AbortSignal}} [options]
   * @returns {Promise<{exitIp: string|null, exitCountry: string}>}
   */
  async probeExitInfo (exitTarget, { timeout = 8000, signal } = {}) {
    const probe = await this.probeUrl(exitTarget, {
      timeout,
      signal,
      readBody: true,
    })
    const info = probe.ok && probe.body ? parseExitInfo(probe.body) : null

    return {
      exitIp: info ? info.ip : null,
      exitCountry: info ? info.code : '',
    }
  }

  /**
   * Fills in the exit country for results that only carry an exit IP, using
   * the cached geo-IP lookup (one batched request for the whole run). Updates
   * the stored statuses in a single write and re-fires `onResult` for rows
   * that gained a country. Call AFTER the real proxy has been restored.
   * @param {Object} results - Map of proxy id -> result (mutated in place).
   * @param {Function} [onResult]
   * @returns {Promise<void>}
   */
  async resolveExitCountries (results, onResult) {
    const pendingIps = [...new Set(
      Object.values(results)
        .filter((result) => result.exitIp && !result.exitCountry)
        .map((result) => result.exitIp),
    )]

    if (pendingIps.length === 0) {
      return
    }

    const cache = await lookupCountries(pendingIps)
    const statuses = await this.getProxyStatuses()
    let dirty = false

    for (const [id, result] of Object.entries(results)) {
      if (!result.exitIp || result.exitCountry) {
        continue
      }

      const info = cache[result.exitIp]

      if (info && info.code) {
        result.exitCountry = info.code

        if (statuses[id]) {
          statuses[id].exitCountry = info.code
          dirty = true
        }
        if (typeof onResult === 'function') {
          onResult(id, result)
        }
      }
    }

    if (dirty) {
      await browser.storage.local.set({ proxyStatuses: statuses })
    }
  }

  /**
   * Routes a single test request through `proxy` (while keeping the user's real
   * traffic on the active proxy) and measures: the ping to the proxy server,
   * the time to open a site through it, and the exit IP/country. Does NOT
   * restore the previous proxy (callers do, possibly after a batch).
   * @param {{protocol: string, uri: string, id?: string}} proxy
   * @param {{timeout?: number, testUrl?: string, signal?: AbortSignal}} [options]
   * @returns {Promise<{alive: boolean, latency: number|null,
   *   ping: number|null, exitIp: string|null, exitCountry: string}>}
   */
  async probeProxy (proxy, { timeout = 8000, testUrl, signal } = {}) {
    const failed = {
      alive: false,
      latency: null,
      ping: null,
      exitIp: null,
      exitCountry: '',
    }

    if (!proxy || !proxy.uri || !proxy.protocol) {
      return failed
    }

    const target =
      testUrl || PROXY_TEST_TARGETS[await this.getProxyTestTarget()]
    const exitTarget = EXIT_INFO_POOL[0]
    let testHost
    let exitHost

    try {
      testHost = new URL(target).hostname
      exitHost = new URL(exitTarget).hostname
    } catch (error) {
      return failed
    }

    const token = proxyToPacToken(proxy.protocol, proxy.uri)

    await this.applyCheckerPac({
      [testHost]: token,
      [exitHost]: token,
    })

    // The ping goes straight to the proxy host (no PAC involved), so it can
    // run concurrently with the through-the-proxy site probe.
    const [ping, result] = await Promise.all([
      this.pingProxyHost(proxy.uri, { timeout, signal }),
      this.probeUrl(target, { timeout, signal }),
    ])

    const exit = result.ok
      ? await this.probeExitInfo(exitTarget, { timeout, signal })
      : { exitIp: null, exitCountry: '' }

    return {
      alive: result.ok,
      latency: result.latency,
      ping,
      exitIp: exit.exitIp,
      exitCountry: exit.exitCountry,
    }
  }

  /**
   * Tests one proxy, stores its status and restores the real proxy afterwards.
   * @returns {Promise<{alive: boolean, latency: number|null,
   *   ping: number|null, exitIp: string|null, exitCountry: string}>}
   */
  async testProxy (proxy, options = {}) {
    let result

    try {
      result = await this.probeProxy(proxy, options)
    } finally {
      await this.restoreProxy()
    }

    // Geo-resolve the exit IP after the real routing is back in place.
    const results = { [proxy.id]: result }

    await this.setProxyStatus(proxy.id, result)
    await this.resolveExitCountries(results)
    return result
  }

  /**
   * Tests a list of proxies *in parallel*: each batch maps several distinct
   * connectivity endpoints (one per proxy) into a single PAC, so up to
   * `PROXY_TEST_POOL.length` proxies are probed at once. The user's real
   * traffic keeps flowing through the active proxy for the whole run, and the
   * run can be aborted via `signal`. `onResult(id, result)` fires the moment
   * each result is known so the UI can update live. Restores routing at the
   * end.
   * @param {Array<{id: string, protocol: string, uri: string}>} proxies
   * @param {{onResult?: Function, signal?: AbortSignal, timeout?: number,
   *   concurrency?: number}} [options]
   * @returns {Promise<Object>} Map of proxy id -> result.
   */
  async testProxies (
    proxies,
    { onResult, signal, timeout = 8000, concurrency } = {},
  ) {
    const results = {}

    if (!Array.isArray(proxies) || proxies.length === 0) {
      return results
    }

    const pool = PROXY_TEST_POOL
    const slots = Math.max(1, Math.min(concurrency || pool.length, pool.length))

    try {
      for (let offset = 0; offset < proxies.length; offset += slots) {
        if (signal && signal.aborted) {
          break
        }

        const batch = proxies.slice(offset, offset + slots)
        const testRoutes = {}
        const assignments = []

        batch.forEach((proxy, index) => {
          const target = pool[index]
          const exitTarget = EXIT_INFO_POOL[index % EXIT_INFO_POOL.length]

          try {
            const token = proxyToPacToken(proxy.protocol, proxy.uri)

            // Route both this slot's connectivity endpoint and its IP-echo
            // endpoint through the candidate, so one PAC covers the site-open
            // timing AND the exit-IP check.
            testRoutes[new URL(target).hostname] = token
            testRoutes[new URL(exitTarget).hostname] = token
            assignments.push({ proxy, target, exitTarget })
          } catch (error) {
            assignments.push({ proxy, target: null, exitTarget: null })
          }
        })

        await this.applyCheckerPac(testRoutes)
        // Let the browser pick up the temporary PAC before probing.
        await new Promise((resolve) => setTimeout(resolve, 200))

        if (signal && signal.aborted) {
          break
        }

        const batchResults = await Promise.all(
          assignments.map(async ({ proxy, target, exitTarget }) => {
            // Ping goes directly to the proxy host (no PAC), so it runs
            // concurrently with the through-the-proxy site probe.
            const [ping, probe] = target
              ? await Promise.all([
                this.pingProxyHost(proxy.uri, { timeout, signal }),
                this.probeUrl(target, { timeout, signal }),
              ])
              : [null, { ok: false, latency: null }]

            // A failure caused by the user aborting is not a dead proxy: leave
            // it untouched so an interrupted run doesn't mislabel good proxies.
            if (!probe.ok && signal && signal.aborted) {
              return null
            }

            const exit = probe.ok && exitTarget
              ? await this.probeExitInfo(exitTarget, { timeout, signal })
              : { exitIp: null, exitCountry: '' }

            const result = {
              alive: probe.ok,
              latency: probe.latency,
              ping,
              exitIp: exit.exitIp,
              exitCountry: exit.exitCountry,
            }

            results[proxy.id] = result

            if (typeof onResult === 'function') {
              onResult(proxy.id, result)
            }
            return { id: proxy.id, result }
          }),
        )

        // Persist this batch's statuses in a SINGLE write. Per-result writes
        // would race (the parallel probes resolve together) and silently lose
        // updates, leaving some dead proxies without a stored "dead" status.
        const statuses = await this.getProxyStatuses()
        let dirty = false

        for (const entry of batchResults) {
          if (entry) {
            statuses[entry.id] = { ...entry.result, ts: Date.now() }
            dirty = true
          }
        }
        if (dirty) {
          await browser.storage.local.set({ proxyStatuses: statuses })
        }
      }
    } finally {
      await this.restoreProxy()
    }

    // Turn exit IPs into countries in one batched lookup, now that the real
    // routing is back (updates stored statuses and re-fires onResult).
    try {
      await this.resolveExitCountries(results, onResult)
    } catch (error) {
      console.warn(`Exit country resolution failed: ${error}`)
    }
    return results
  }

  /**
   * Removes several proxies at once in a single pass over storage (list,
   * statuses, chain), instead of a full read-modify-write round-trip per
   * proxy. Nothing races and no removal is lost.
   * @param {Iterable<string>} ids - Ids of the proxies to remove.
   * @returns {Promise<number>} How many proxies were actually removed.
   */
  async removeCustomProxiesByIds (ids) {
    const deadIds = new Set(ids)

    if (deadIds.size === 0) {
      return 0
    }

    const customProxies = await this.getCustomProxies()
    const remaining = customProxies.filter((proxy) => !deadIds.has(proxy.id))
    const removed = customProxies.length - remaining.length

    if (removed === 0) {
      return 0
    }

    await browser.storage.local.set({ customProxies: remaining })

    const statuses = await this.getProxyStatuses()
    let statusesDirty = false

    for (const id of deadIds) {
      if (id in statuses) {
        delete statuses[id]
        statusesDirty = true
      }
    }
    if (statusesDirty) {
      await browser.storage.local.set({ proxyStatuses: statuses })
    }

    const chain = await this.getProxyChain()
    const nextChain = chain.filter((id) => !deadIds.has(id))

    if (nextChain.length !== chain.length) {
      await this.setProxyChain(nextChain)
    }

    return removed
  }

  /**
   * Removes every proxy that is NOT ticked into the chain, keeping only the
   * ones the user actually routes through. The built-in proxy is untouched
   * (it is not part of the custom list).
   * @returns {Promise<{removed: number}>}
   */
  async removeUncheckedCustomProxies () {
    const customProxies = await this.getCustomProxies()
    const chain = new Set(await this.getProxyChain())
    const uncheckedIds = customProxies
      .filter((proxy) => !chain.has(proxy.id))
      .map((proxy) => proxy.id)

    return { removed: await this.removeCustomProxiesByIds(uncheckedIds) }
  }

  /**
   * Removes every proxy that has never been tested (no stored status). Dead
   * ones are covered by {@link removeDeadCustomProxies}.
   * @returns {Promise<{removed: number}>}
   */
  async removeUntestedCustomProxies () {
    const customProxies = await this.getCustomProxies()
    const statuses = await this.getProxyStatuses()
    const untestedIds = customProxies
      .filter((proxy) => !(proxy.id in statuses))
      .map((proxy) => proxy.id)

    return { removed: await this.removeCustomProxiesByIds(untestedIds) }
  }

  /**
   * Removes every user-defined proxy. The chain keeps the built-in proxy if
   * it was ticked; otherwise custom proxying is disabled.
   * @returns {Promise<{removed: number}>}
   */
  async removeAllCustomProxies () {
    const customProxies = await this.getCustomProxies()
    const ids = customProxies.map((proxy) => proxy.id)

    return { removed: await this.removeCustomProxiesByIds(ids) }
  }

  /**
   * Removes every proxy whose last check marked it dead. Falls back to a still
   * working proxy (or disables custom proxying) if a removed one was active.
   * @returns {Promise<{removed: number}>}
   */
  async removeDeadCustomProxies () {
    const customProxies = await this.getCustomProxies()
    const statuses = await this.getProxyStatuses()
    const deadIds = customProxies
      .filter((proxy) => {
        const status = statuses[proxy.id]

        return status && status.alive === false
      })
      .map((proxy) => proxy.id)

    return { removed: await this.removeCustomProxiesByIds(deadIds) }
  }

  // ---------------------------------------------------------------------------
  // Auto-fetching proxy lists from configured sources
  // ---------------------------------------------------------------------------

  async getProxySourcesSettings () {
    const {
      proxySources,
      proxySourcesEnabled,
      proxySourcesIntervalMinutes,
      proxySourcesUseProxy,
      proxySourcesAutoTest,
      proxySourcesLastRun,
    } = await browser.storage.local.get({
      proxySources: [],
      proxySourcesEnabled: false,
      proxySourcesIntervalMinutes: 60,
      proxySourcesUseProxy: false,
      proxySourcesAutoTest: true,
      proxySourcesLastRun: 0,
    })

    return {
      sources: proxySources,
      enabled: proxySourcesEnabled,
      intervalMinutes: proxySourcesIntervalMinutes,
      useProxy: proxySourcesUseProxy,
      autoTest: proxySourcesAutoTest,
      lastRun: proxySourcesLastRun,
    }
  }

  async setProxySourcesSettings (
    { sources, enabled, intervalMinutes, useProxy, autoTest } = {},
  ) {
    const updates = {}

    if (Array.isArray(sources)) {
      updates.proxySources = sources.map((url) => url.trim()).filter(Boolean)
    }
    if (typeof enabled === 'boolean') {
      updates.proxySourcesEnabled = enabled
    }
    if (Number.isFinite(intervalMinutes)) {
      updates.proxySourcesIntervalMinutes = Math.max(5, Math.round(intervalMinutes))
    }
    if (typeof useProxy === 'boolean') {
      updates.proxySourcesUseProxy = useProxy
    }
    if (typeof autoTest === 'boolean') {
      updates.proxySourcesAutoTest = autoTest
    }

    await browser.storage.local.set(updates)
    await this.applyProxySourcesSchedule()
  }

  /**
   * (Re)schedules the background fetch alarm to match the current settings.
   * @returns {Promise<void>}
   */
  async applyProxySourcesSchedule () {
    await Promise.resolve(
      browser.alarms.clear(TaskType.FETCH_PROXY_SOURCES),
    ).catch(() => {})

    const { enabled, sources, intervalMinutes } =
      await this.getProxySourcesSettings()

    if (enabled && sources.length > 0) {
      const minutes = Math.max(5, intervalMinutes || 60)

      browser.alarms.create(TaskType.FETCH_PROXY_SOURCES, {
        delayInMinutes: minutes,
        periodInMinutes: minutes,
      })
    }
  }

  /**
   * Fetches one source URL's body, optionally through the active proxy chain
   * (otherwise directly). Restores the real proxy afterwards.
   * @returns {Promise<string>} The body text, or '' on failure.
   */
  async fetchSourceText (url, useProxy) {
    let host

    try {
      host = new URL(url).hostname
    } catch (error) {
      return ''
    }

    const chain = useProxy ? await this.getChainProxyConfigs() : []
    const routedThroughProxy = chain.length > 0

    if (routedThroughProxy) {
      const directive = chain
        .map(({ protocol, uri }) => `${protocol} ${uri}`)
        .join('; ')

      await this.applyPacData(`function FindProxyForURL(url, h) {
        if (h === ${JSON.stringify(host)}) { return '${directive};'; }
        return 'DIRECT';
      }`)
    }

    try {
      const response = await fetchWithTimeout(url, {
        timeout: 15000,
        cache: 'no-store',
      })

      return await response.text()
    } catch (error) {
      console.error(`Failed to fetch proxy source ${url}: ${error}`)
      return ''
    } finally {
      if (routedThroughProxy) {
        await this.restoreProxy()
      }
    }
  }

  /**
   * Reorders the proxy list by last-measured latency: alive (fastest first),
   * then untested, then dead. The chain (referenced by id) is unaffected.
   * @returns {Promise<void>}
   */
  async sortProxiesByLatency () {
    const customProxies = await this.getCustomProxies()
    const statuses = await this.getProxyStatuses()
    const rank = (proxy) => {
      const status = statuses[proxy.id]

      if (status && status.alive) {
        return status.latency
      }
      if (!status) {
        return Number.MAX_SAFE_INTEGER - 1
      }
      return Number.MAX_SAFE_INTEGER
    }

    customProxies.sort((first, second) => rank(first) - rank(second))
    await browser.storage.local.set({ customProxies })
  }

  /**
   * Background job: fetch proxies from the configured sources, add the new
   * ones, then (optionally) test them, drop the dead ones and sort the list by
   * latency.
   * @returns {Promise<{added: number, alive: number, removed: number}>}
   */
  async fetchProxySources ({ force = false } = {}) {
    const settings = await this.getProxySourcesSettings()

    // The scheduled run respects the on/off toggle; "Fetch now" forces it.
    if (settings.sources.length === 0 || (!settings.enabled && !force)) {
      return { added: 0, alive: 0, removed: 0 }
    }

    const collected = []

    for (const url of settings.sources) {
      const text = await this.fetchSourceText(url, settings.useProxy)

      if (text) {
        collected.push(...parseProxyList(text))
      }
    }

    const added = await this.addCustomProxies(collected)
    let alive = 0
    let removed = 0

    if (settings.autoTest && added.length > 0) {
      // Bound the work so a long list can't outlive the service worker.
      const toTest = added.slice(0, 40)
      const results = await this.testProxies(toTest, { timeout: 5000 })
      const deadIds = []

      for (const proxy of toTest) {
        if (results[proxy.id] && results[proxy.id].alive) {
          alive += 1
        } else {
          deadIds.push(proxy.id)
        }
      }

      // Batch-remove the dead ones: deleting one by one costs several storage
      // round-trips per proxy, which adds up fast on a big fetched list.
      removed = await this.removeCustomProxiesByIds(deadIds)
      await this.sortProxiesByLatency()
    }

    await browser.storage.local.set({ proxySourcesLastRun: Date.now() })
    console.warn(
      `Proxy sources: +${added.length}, alive ${alive}, removed ${removed}`,
    )
    return { added: added.length, alive, removed }
  }

  async removeLocalProxy () {
    await browser.storage.local.set({ useLocalProxy: false })
    await browser.storage.local.remove(['localProxyURI'])
  }

  async removeBadProxies () {
    await browser.storage.local.set({ badProxies: [] })
  }

  async getBadProxies () {
    const { badProxies } =
      await browser.storage.local.get({ badProxies: [] })

    return badProxies
  }
}

export default new ProxyManager()
