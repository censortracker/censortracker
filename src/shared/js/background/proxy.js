import { getPacScript } from 'Background/pac'

import browser from './browser-api'
import {
  DEFAULT_PROXY_TEST_TARGET,
  PROXY_TEST_TARGETS,
  TaskType,
} from './constants'
import registry from './registry'
import { fetchWithTimeout, parseProxyList } from './utilities'

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
   * @returns {Promise<void>}
   */
  async applyPacData (pacData) {
    const config = {}

    if (browser.isFirefox) {
      const blob = new Blob([pacData], {
        type: 'application/x-ns-proxy-autoconfig',
      })

      config.value = {
        proxyType: 'autoConfig',
        autoConfigUrl: URL.createObjectURL(blob),
      }
    } else {
      config.scope = 'regular'
      config.value = {
        mode: 'pac_script',
        pacScript: {
          data: pacData,
          mandatory: false,
        },
      }
    }
    await browser.proxy.settings.set(config)
  }

  async setProxy () {
    const domains = await registry.getDomains()

    if (domains.length === 0) {
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
      pacData = getPacScript({ domains, proxies: chain })
    } else {
      const {
        proxyServerURI,
        proxyServerProtocol,
      } = await this.getProxyingRules()

      pacData = getPacScript({
        domains,
        proxyServerURI,
        proxyServerProtocol,
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
    } = await browser.storage.local.get({
      customProxies: [],
      customProxyServerURI: '',
      customProxyProtocol: '',
    })

    if (customProxies.length === 0 && customProxyServerURI) {
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
   * Builds a PAC that routes only the test host through `proxy` (everything
   * else DIRECT), so a single fetch measures that one proxy in isolation.
   * @param {{protocol: string, uri: string}} proxy
   * @param {string} testHost
   * @returns {string}
   */
  buildProbePac (proxy, testHost) {
    const directive = `${proxy.protocol} ${proxy.uri}`

    return `function FindProxyForURL(url, host) {
      if (host === ${JSON.stringify(testHost)}) {
        return '${directive};';
      }
      return 'DIRECT';
    }`
  }

  /**
   * Routes a single test request through `proxy` and measures the round-trip.
   * Does NOT restore the previous proxy (callers do, possibly after a batch).
   * @param {{protocol: string, uri: string, id?: string}} proxy
   * @param {{timeout?: number, testUrl?: string}} [options]
   * @returns {Promise<{alive: boolean, latency: number|null}>}
   */
  async probeProxy (proxy, { timeout = 8000, testUrl } = {}) {
    if (!proxy || !proxy.uri || !proxy.protocol) {
      return { alive: false, latency: null }
    }

    let target = testUrl

    if (!target) {
      target = PROXY_TEST_TARGETS[await this.getProxyTestTarget()]
    }

    let testHost

    try {
      testHost = new URL(target).hostname
    } catch (error) {
      return { alive: false, latency: null }
    }

    await this.applyPacData(this.buildProbePac(proxy, testHost))

    const url = `${target}${target.includes('?') ? '&' : '?'}_ct=${Date.now()}`
    const now = () =>
      (typeof performance !== 'undefined' && performance.now)
        ? performance.now()
        : Date.now()
    const started = now()
    let alive = false

    try {
      // Any HTTP response means the proxy relayed our request to the cloud.
      await fetchWithTimeout(url, {
        method: 'GET',
        timeout,
        cache: 'no-store',
        redirect: 'manual',
      })
      alive = true
    } catch (error) {
      alive = false
    }

    return { alive, latency: alive ? Math.round(now() - started) : null }
  }

  /**
   * Tests one proxy, stores its status and restores the real proxy afterwards.
   * @returns {Promise<{alive: boolean, latency: number|null}>}
   */
  async testProxy (proxy, options = {}) {
    try {
      const result = await this.probeProxy(proxy, options)

      await this.setProxyStatus(proxy.id, result)
      return result
    } finally {
      await this.restoreProxy()
    }
  }

  /**
   * Tests a list of proxies sequentially (they share the global proxy
   * setting), restoring the real proxy once at the end. `onResult(id, result)`
   * is called after each one so the UI can update live.
   * @returns {Promise<Object>} Map of proxy id -> result.
   */
  async testProxies (proxies, { onResult, ...options } = {}) {
    const results = {}

    try {
      for (const proxy of proxies) {
        const result = await this.probeProxy(proxy, options)

        results[proxy.id] = result
        await this.setProxyStatus(proxy.id, result)

        if (typeof onResult === 'function') {
          onResult(proxy.id, result)
        }
      }
    } finally {
      await this.restoreProxy()
    }
    return results
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

      for (const proxy of toTest) {
        if (results[proxy.id] && results[proxy.id].alive) {
          alive += 1
        } else {
          await this.deleteCustomProxy(proxy.id)
          removed += 1
        }
      }
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
