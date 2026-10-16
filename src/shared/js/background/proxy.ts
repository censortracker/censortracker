import { getPacScript } from 'Background/pac'

import browser from './browser-api'
import { hasDataConsent, isConsentError, withDataConsent } from './data-consent'
import type { DomainIndexData } from './domain-index'
import { buildDomainIndex } from './domain-index'
import { findHostMatch } from './host-match'
import { getMessage, initializeLanguage } from './i18n'
import ProxyClient from './localproxy'
import { isPrivateHost } from './private-host'
import { parseProxyAddress } from './proxy-address'
import { countryCode, currentProxyCheck } from './proxy-check-data'
import { readProxyState } from './proxy-list'
import type { ProxyRecord } from './proxy-record'
import { hasEndpoint, proxyAuthSupported, proxyKey } from './proxy-record'
import {
  applyPac, getProbeRoutes, getRouteRevision, proxyAllowed,
  restoreServiceRoute, setServiceRoute, withProxyLock,
} from './proxy-route'
import registry from './registry'
import type { RouteDecision } from './routing'
import { createRouter, routingConfig } from './routing'
import Settings from './settings'
import { errorMessage } from './value'

let cachedRouter: {
  revision: number;
  pending: Promise<{
    resolve: ReturnType<typeof createRouter>;
    proxies: Map<string,
      ProxyRecord>
  }>
} | null

type ProviderIndex = {
  proxyKeys: string[];
  domains: DomainIndexData | null
} | null
let cachedAntizapret: Promise<ProviderIndex> | null

export const watchProxyCache = () => {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.antizapret) {
      cachedAntizapret = null
    }
  })
}

const getAntizapret = async (): Promise<ProviderIndex> => {
  const pending: Promise<ProviderIndex> =
    cachedAntizapret || (cachedAntizapret =
      browser.storage.local.get({ antizapret: null }).then(
        async ({ antizapret }) => antizapret && {
          proxyKeys: antizapret.proxyKeys,
          domains: await buildDomainIndex(antizapret.domains,
            () => cachedAntizapret === pending),
        },
      ))

  try {
    const data = await pending

    return cachedAntizapret === pending ? data : getAntizapret()
  } catch (error) {
    if (cachedAntizapret === pending) {
      cachedAntizapret = null
    }
    throw error
  }
}

class ProxyManager {
  async getSelectedProxies (): Promise<ProxyRecord[]> {
    const { useLocalProxy, localProxyURI, localProxyAlive } =
      await browser.storage.local.get({
        useLocalProxy: false, localProxyURI: null, localProxyAlive: false,
      })

    // Amnezia reports its SOCKS5 port through the local API.
    if (useLocalProxy) {
      if (!localProxyAlive || !localProxyURI) {
        return []
      }
      return [{
        id: 'local',
        protocol: 'SOCKS5',
        ...parseProxyAddress(localProxyURI),
      }]
    }

    const { proxies, selectedProxyIds, builtin } = await readProxyState()
    const catalog = new Map(
      [builtin, ...proxies].map((proxy) => [proxy.id, proxy]),
    )

    const selected = selectedProxyIds.map((id) => catalog.get(id))
      .filter((proxy) => proxy !== undefined).filter(hasEndpoint)
      .filter((proxy) => (!proxy.restricted || proxy.provider) &&
        proxyAuthSupported(proxy, browser.isFirefox))
    const { proxyFailures, proxyChecks } =
      await browser.storage.local.get({
        proxyFailures: {}, proxyChecks: {},
      })
    const antizapret = selected.some((proxy) => proxy.provider)
      ? await getAntizapret() : null

    return Promise.all(selected.map(async (proxy) => {
      const failure = await currentProxyCheck(proxy, proxyFailures)
      const check = await currentProxyCheck(proxy, proxyChecks)

      return {
        ...proxy,
        retryAt: proxy.provider &&
          !antizapret?.proxyKeys.includes(proxyKey(proxy))
          ? Number.MAX_SAFE_INTEGER : failure?.retryAt || 0,
        exitCountry: check?.status === 'ok' ? countryCode(check.exitCountry) : '',
        countryExpiresAt: check && Number.isFinite(check.checkedAt)
          ? check.checkedAt + 24 * 60 * 60 * 1000 : 0,
      }
    }))
  }

  async getRoutingOptions () {
    const domains = await registry.getRoutingDomains()
    const { ignoredHosts, proxyAll, siteCountryRules } =
      await browser.storage.local.get({
        ignoredHosts: [],
        proxyAll: false,
        siteCountryRules: {},
      })
    const proxies = await this.getSelectedProxies()
    const antizapret = proxies.some((proxy) => proxy.provider)
      ? await getAntizapret() : null
    const providerDomains = antizapret?.domains || []

    return {
      domains,
      providerDomains,
      ignoredHosts,
      proxyAll,
      siteCountryRules,
      probes: getProbeRoutes(),
      proxies,
    }
  }

  async getRouteForHost (host: string): Promise<Omit<RouteDecision, 'proxies'> & { proxies: ProxyRecord[] }> {
    const revision = getRouteRevision()

    if (!cachedRouter || cachedRouter.revision !== revision) {
      cachedRouter = {
        revision,
        pending: this.getRoutingOptions().then((options) => ({
          resolve: createRouter(
            routingConfig(options), findHostMatch, isPrivateHost,
          ),
          proxies: new Map([
            ...options.proxies,
            ...options.probes.map(({ proxy }) => proxy),
          ].map((proxy) => [proxy.id, proxy])),
        })),
      }
    }
    const snapshot = cachedRouter
    let router

    try {
      router = await snapshot.pending
    } catch (error) {
      if (cachedRouter === snapshot) {
        cachedRouter = null
      }
      throw error
    }
    if (revision !== getRouteRevision()) {
      return this.getRouteForHost(host)
    }
    const decision = router.resolve(host)

    return {
      ...decision,
      // The router returns only IDs from its own proxy map.
      proxies: decision.proxies.flatMap((id) => {
        const proxy = router.proxies.get(id)

        if (!proxy) {
          return []
        }
        return decision.type === 'probe' ? { ...proxy, checking: true } : proxy
      }),
    }
  }

  async getProxyingRules () {
    const selected = (await this.getSelectedProxies())
      .find(({ retryAt = 0, provider }) => !provider && retryAt <= Date.now())

    return selected ? {
      id: selected.id,
      proxyServerProtocol: selected.protocol,
      proxyServerURI: `${selected.host}:${selected.port}`,
    } : {}
  }

  async getServiceProxyRoute (hostname: string) {
    const { ignoredHosts, siteCountryRules } =
      await browser.storage.local.get({
        ignoredHosts: [], siteCountryRules: {},
      })
    const proxies = await this.getSelectedProxies()
    const antizapret = proxies.some((proxy) => proxy.provider)
      ? await getAntizapret() : null
    const options = {
      domains: [hostname],
      ignoredHosts,
      siteCountryRules,
      providerDomains: antizapret?.domains || [],
      proxies,
    }

    const resolve = createRouter(
      routingConfig(options), findHostMatch, isPrivateHost,
    )

    return resolve(hostname)
  }

  async requestIncognitoAccess () {
    if (browser.isFirefox) {
      const allowed =
        await browser.extension.isAllowedIncognitoAccess()

      await browser.browserAction.setBadgeText({ text: allowed ? '' : '✕' })
      await browser.storage.local.set({
        privateBrowsingPermissionsRequired: !allowed,
      })
      return allowed
    }
    return true
  }

  async setProxy () {
    return withProxyLock(() => this.setProxyInBackground())
  }

  async setProxyInBackground ({ ping = true } = {}): Promise<boolean> {
    if (!await hasDataConsent()) {
      await this.removeProxyInBackground()
      return false
    }
    const revision = getRouteRevision()

    const { useLocalProxy, localProxyAlive } = await browser.storage.local.get({
      useLocalProxy: false, localProxyAlive: false,
    })

    if (useLocalProxy && !localProxyAlive) {
      await browser.storage.local.set({ proxySetupError: 'Local proxy is unavailable' })
      await this.removeProxyInBackground()
      return false
    }
    if (!await proxyAllowed()) {
      await browser.storage.local.set({
        proxySetupError: 'Proxy use is disabled or controlled by another extension',
      })
      return false
    }
    const options = browser.isFirefox ? null : await this.getRoutingOptions()

    if (revision !== getRouteRevision()) {
      return this.setProxyInBackground({ ping })
    }

    const retryPing = ping && await this.pingInBackground() === false

    if (!await proxyAllowed()) {
      return false
    }

    if (revision !== getRouteRevision()) {
      return this.setProxyInBackground({ ping })
    }

    try {
      // Firefox's PAC runtime cannot reliably load very large registries.
      // Its request listener uses the same router; the PAC is a fail-closed guard.
      const pacData = options
        ? getPacScript(options)
        : 'function FindProxyForURL() { return "PROXY 127.0.0.1:0"; }'

      await applyPac(pacData, true)
      // An inherited system/manual proxy cannot accept an exact-host override.
      // Retry the knock once CT owns the new PAC.
      if (retryPing) {
        await this.pingInBackground()
      }
      if (!await proxyAllowed()) {
        await this.removeProxyInBackground()
        return false
      }
      if (revision !== getRouteRevision()) {
        return this.setProxyInBackground({ ping })
      }
      const proxies = options?.proxies || await this.getSelectedProxies()

      await browser.storage.local.set({
        proxyIsAlive: proxies.some(({ retryAt = 0 }) => retryAt <= Date.now()),
      })
      await browser.storage.local.remove('proxySetupError')
      await this.requestIncognitoAccess()
      console.info('PAC has been set successfully!')
      return true
    } catch (error) {
      if (isConsentError(error)) {
        await this.removeProxyInBackground()
        return false
      }
      console.error(`PAC could not be set: ${String(error)}`)
      await browser.storage.local.set({
        proxyIsAlive: false, proxySetupError: errorMessage(error),
      })
      await this.requestIncognitoAccess()
      return false
    }
  }

  async removeProxy () {
    return withProxyLock(() => this.removeProxyInBackground())
  }

  async removeProxyInBackground () {
    await browser.proxy.settings.clear({})
    console.info('Proxy settings removed.')
  }

  async alive () {
    const { proxyIsAlive } =
      await browser.storage.local.get({ proxyIsAlive: true })

    return proxyIsAlive
  }

  async ping (force = false) {
    return withProxyLock(() => this.pingInBackground(force))
  }

  // The caller holds the route lock until the direct knock route is restored.
  // Return false only when proxy setup must take control before the knock.
  async pingInBackground (force = false) {
    if (typeof force !== 'boolean') {
      throw new TypeError('Invalid proxy ping option')
    }
    if (!await proxyAllowed()) {
      return undefined
    }
    const {
      localProxyURI,
      proxyPingURI,
      useOwnProxy,
      selectedProxyIds,
    } = await browser.storage.local.get({
      localProxyURI: null,
      proxyPingURI: null,
      useOwnProxy: false,
      selectedProxyIds: null,
    })

    const usesBuiltin = selectedProxyIds
      ? selectedProxyIds.includes('builtin') : !useOwnProxy

    if ((!force && (!usesBuiltin || localProxyURI)) || !proxyPingURI) {
      return undefined
    }

    const controller = new AbortController()
    let timeout

    try {
      const { host, port } = parseProxyAddress(proxyPingURI)

      // The knock must reach the server from the user's IP, even when the
      // current PAC uses proxy-all or still points to an old managed endpoint.
      if (!await setServiceRoute(host, 'DIRECT')) {
        return false
      }
      if (!await proxyAllowed()) {
        return undefined
      }
      timeout = setTimeout(() => controller.abort(), 1000)
      await withDataConsent(() => fetch(`https://${host}:${port}`, {
        method: 'POST',
        signal: controller.signal,
        redirect: 'error',
        credentials: 'omit',
        headers: {
          'Content-type': 'application/json; charset=UTF-8',
        },
        body: JSON.stringify({
          type: 'ping',
        }),
      }), controller)
    } catch (error) {
      if (isConsentError(error)) {
        return undefined
      }
      // The knock port can reject the connection after it receives the packet.
    } finally {
      clearTimeout(timeout)
      await restoreServiceRoute()
    }

    console.log(`Knock attempted: ${proxyPingURI}`)
    return undefined
  }

  async isEnabled () {
    const { useProxy } = await browser.storage.local.get({ useProxy: true })

    return useProxy
  }

  async enableProxy () {
    console.log('Proxying enabled.')
    await browser.storage.local.set({ useProxy: true })
  }

  async disableProxy () {
    console.info('Proxying disabled.')
    await browser.storage.local.set({ useProxy: false })
  }

  async controlledByOtherExtensions () {
    const { levelOfControl } = await browser.proxy.settings.get({})

    return levelOfControl === 'controlled_by_other_extensions'
  }

  async takeControl () {
    const self = await browser.management.getSelf()
    const extensions = await browser.management.getAll()

    for (const { id, name, permissions } of extensions) {
      if (permissions?.includes('proxy') && name !== self.name) {
        console.warn(`Disabling ${name}...`)
        await browser.management.setEnabled(id, false)
      }
    }
  }

  async setLocalProxy (enabled: boolean) {
    return withProxyLock(() => this.setLocalProxyInBackground(enabled))
  }

  async setLocalProxyInBackground (enabled: boolean) {
    if (typeof enabled !== 'boolean') {
      throw new TypeError('Invalid local proxy mode')
    }
    const { useLocalProxy } = await browser.storage.local.get('useLocalProxy')

    await browser.storage.local.set({
      useLocalProxy: enabled, localProxyURI: null, localProxyAlive: false,
    })
    if (enabled) {
      await this.removeProxyInBackground()
      await this.syncLocalProxyInBackground({ startIfMissing: true })
    } else {
      if (useLocalProxy && await hasDataConsent()) {
        await ProxyClient.stop()
      }
      await this.setProxyInBackground()
    }
  }

  async syncLocalProxy (options?: { startIfMissing?: boolean }) {
    return withProxyLock(() => this.syncLocalProxyInBackground(options))
  }

  async usingLocalProxy () {
    const { useLocalProxy } = await browser.storage.local.get('useLocalProxy')

    return await hasDataConsent() && Boolean(useLocalProxy) &&
      await this.isEnabled() &&
      await Settings.extensionEnabled()
  }

  async syncLocalProxyInBackground ({ startIfMissing = false } = {}) {
    if (!await this.usingLocalProxy()) {
      return { alive: false }
    }
    let port = await ProxyClient.ping(2500)

    if (!await this.usingLocalProxy()) {
      return { alive: false }
    }
    if (!port && startIfMissing) {
      port = await ProxyClient.start(3000)
    }
    if (!await this.usingLocalProxy()) {
      return { alive: false }
    }
    const { localProxyURI, localProxyAlive } = await browser.storage.local.get({
      localProxyURI: null, localProxyAlive: false,
    })
    const nextURI = port ? `127.0.0.1:${port}` : null

    if (nextURI !== localProxyURI || Boolean(port) !== localProxyAlive) {
      await browser.storage.local.set({
        localProxyURI: nextURI, localProxyAlive: Boolean(port),
      })
    }
    if (!port) {
      await this.removeProxyInBackground()
      const { showNotifications } = await browser.storage.local.get({
        showNotifications: true,
      })

      if (localProxyAlive && showNotifications) {
        await initializeLanguage()
        await browser.notifications.create('localProxyIsDown', {
          type: 'basic',
          title: Settings.getName(),
          iconUrl: Settings.getDangerIcon(),
          message: getMessage('localProxyNotFoundDesc'),
        }).catch(() => console.warn('Local proxy notification failed'))
      }
    } else if (nextURI !== localProxyURI || !localProxyAlive) {
      await this.setProxyInBackground()
    }
    return { alive: Boolean(port) }
  }

  async removeBadProxies () {
    await browser.storage.local.set({ badProxies: [] })
  }
}

export default new ProxyManager()
