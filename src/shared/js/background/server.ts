import { callBackground } from './background-rpc'
import { forEachBatch } from './batches'
import browser from './browser-api'
import { ConsentRequiredError, hasDataConsent } from './data-consent'
import { setRegistryState } from './index-cache'
import ProxyManager from './proxy'
import type { RegistryCache } from './registry-request'
import { isRegistryCancellation } from './registry-request'
import { refreshRegistrySource } from './registry-source'
import type { RegionConfig, ServiceProxy } from './service-config'
import {
  getRegionConfig,
  validConfig, validCountry, validCustomRegistry, validDomain, validDomains,
  validORI, validProxies,
} from './service-config'
import type { ServiceMirrors } from './service-mirrors'
import { getServiceMirrors, requestMirroredService } from './service-mirrors'
import type { ServiceResponse } from './service-request'
import { requestService } from './service-request'
import type { RequestError } from './value'

export type RegistryPart = 'primary' | 'custom' | 'backend'
export interface BuiltinRegistryCache {
  countryCode: string
  primary: string[]
  custom: string[]
  backend?: string[]
  validators?: Partial<Record<RegistryPart,
Partial<RegistryCache> & { skipped: number }>>
  updatedAt?: number
}
export interface SynchronizeOptions {
  syncRegistry?: boolean
  syncProxy?: boolean
  region?: { countryCode: string; countryName: string }
}

const fetchConfig = async (mirrors: ServiceMirrors) => {
  const { currentRegionCode } = await browser.storage.local.get({
    currentRegionCode: '',
  })
  let countryCode = currentRegionCode
  let geoIPStatus = 'manual'

  if (!countryCode) {
    try {
      const { data } = await requestMirroredService(mirrors, 'geoip', validCountry)

      countryCode = data!.countryCode.toUpperCase()
      geoIPStatus = 'direct'
    } catch (error_) {
      const error = error_ as RequestError

      if (isRegistryCancellation(error)) {
        throw error
      }
      console.warn(`[GeoIP] Using RU fallback: ${error.message}`)
      countryCode = 'RU'
      geoIPStatus = `RU fallback: ${error.message}`
    }
  }
  const config = getRegionConfig(countryCode)

  await browser.storage.local.set({
    localConfig: config,
    backendIsIntermittent: false,
    unsupportedCountry: false,
    geoIPStatus,
  })
  return config
}

const selectProxy = (proxies: ServiceProxy[]) => {
  const totalWeight = proxies.reduce((total, { weight }) => {
    return total + Math.max(Number(weight) || 0, 0)
  }, 0)

  if (totalWeight === 0) {
    return null
  }

  let randomWeight = Math.random() * totalWeight

  for (const proxy of proxies) {
    randomWeight -= Math.max(Number(proxy.weight) || 0, 0)

    if (randomWeight < 0) {
      return proxy
    }
  }

  return proxies[proxies.length - 1]
}

/**
 * Fetches available configurations and selects a proxy server.
 * @returns {Promise<void>} Resolves when the proxy is selected.
 */
const fetchProxy = async (mirrors: ServiceMirrors) => {
  const { badProxies } = await browser.storage.local.get({ badProxies: [] })

  console.group('[Proxy] Fetching proxy...')

  try {
    if (badProxies.length > 0) {
      console.log('Excluding bad proxies:')
      console.table(badProxies)
    }

    const { data: proxyList } =
      await requestMirroredService(mirrors, 'proxyList', validProxies)

    const activeProxies = proxyList!.filter(({ active, weight }) => {
      return active && Number(weight) > 0
    })

    let availableProxies = activeProxies.filter(({ server }) => {
      return !badProxies.includes(server)
    })

    if (
      availableProxies.length === 0 &&
      activeProxies.length > 0 &&
      badProxies.length > 0
    ) {
      console.warn('All active proxies were excluded. Retrying the active pool.')
      availableProxies = activeProxies
      await browser.storage.local.set({ badProxies: [] })
    }

    const proxy = selectProxy(availableProxies)

    if (!proxy) {
      throw new Error('No active proxy servers are available')
    }

    const {
      server,
      port,
      pingHost,
      pingPort,
    } = proxy

    const proxyPingURI = `${pingHost}:${pingPort}`
    const proxyServerURI = `${server}:${port}`

    console.log(`Proxy server fetched: ${proxyServerURI}!`)

    await browser.storage.local.remove([
      'fallbackReason',
      'fallbackProxyInUse',
      'fallbackProxyError',
    ])

    await browser.storage.local.set({
      proxyPingURI,
      proxyServerURI,
      currentProxyServer: server,
      proxyLastFetchTs: Date.now(),
    })
  } finally {
    console.groupEnd()
  }
}

const requestRegistry = async (config: RegionConfig,
  mirrors: ServiceMirrors,
  cache?: Partial<RegistryCache>): Promise<ServiceResponse<unknown[]>> => {
  const { registryUrl, countryCode } = config

  if (!registryUrl) {
    return { data: [] }
  }
  return requestMirroredService(
    mirrors, 'registry', validDomains, { countryCode, cache },
  )
}

const requestCustomRegistry = async (config: RegionConfig,
  mirrors: ServiceMirrors,
  cache?: Partial<RegistryCache>,
): Promise<ServiceResponse<unknown[]> | null> => {
  const result = await requestMirroredService(
    mirrors, 'config', validConfig, { countryCode: config.countryCode },
  ).catch((error) => {
    if (isRegistryCancellation(error)) {
      throw error
    }
    return null
  })

  if (!result) {
    return null
  }

  config.customRegistryUrl = result.data!.customRegistryUrl || null
  await browser.storage.local.set({ localConfig: config })
  if (!config.customRegistryUrl) {
    return { data: [] }
  }
  const records = await requestService(
    config.customRegistryUrl, validCustomRegistry, { cache },
  )

  return records.unchanged ? records : {
    ...records, data: records.data!.flatMap((record) => record.domains),
  }
}

const fetchRegistry = async (config: RegionConfig, mirrors: ServiceMirrors) => {
  const { countryCode } = config
  const {
    registryRegionCode, registryCache, domains: previousDomains,
    domainsRevision,
  } =
    await browser.storage.local.get({
      registryRegionCode: '', registryCache: null, domains: [], domainsRevision: '',
    })
  const cache: BuiltinRegistryCache =
    registryCache?.countryCode === countryCode ? registryCache : {

      countryCode,
      primary: registryRegionCode === countryCode ? previousDomains : [],
      custom: [],
    }

  cache.backend ||= []
  let changed = registryRegionCode !== countryCode || !cache.validators ||
    (previousDomains.length === 0 &&
      [cache.primary, cache.custom, cache.backend]
        .some((names) => names.length > 0))
  let cacheChanged = changed

  cache.validators ||= {}

  if (registryRegionCode !== countryCode) {
    await setRegistryState({
      domains: [], registryRegionCode: countryCode,
    })
    await ProxyManager.setProxy()
  }
  await browser.storage.local.set({
    registryStatus: { state: 'loading', skipped: 0, error: '' },
  })
  const errors = []
  let skipped = 0

  const sources: [RegistryPart,
    () => Promise<ServiceResponse<unknown[]> | null>][] = [
    ['primary', () => requestRegistry(config, mirrors, cache.validators!.primary || {})],
    ['custom', () => requestCustomRegistry(config, mirrors, cache.validators!.custom || {})],
    ['backend', () => requestMirroredService(
      mirrors, 'domains', validDomains, { countryCode, maxRedirects: 5, cache: cache.validators!.backend || {} },
    ).catch((error) => {
      if (isRegistryCancellation(error)) {
        throw error
      }
      return null
    })],
  ]

  for (const [source, request] of sources) {
    try {
      const result = await request()

      if (result === null || result.unchanged) {
        skipped += cache.validators[source]?.skipped || 0
        continue
      }
      const { data } = result
      const filtered: string[] = []
      const previous = cache[source]
      let sourceChanged = false

      await forEachBatch(data!.length, (start, end) => {
        for (let index = start; index < end; index++) {
          const domain = data![index]

          if (validDomain(domain)) {
            sourceChanged ||= previous?.[filtered.length] !== domain
            filtered.push(domain)
          }
        }
      })

      changed ||= sourceChanged || previous?.length !== filtered.length
      cache[source] = filtered
      const omitted = data!.length - filtered.length

      const validator = { ...result.cache, skipped: omitted }

      cacheChanged ||= changed || JSON.stringify(cache.validators[source]) !==
        JSON.stringify(validator)
      cache.validators[source] = validator
      skipped += omitted
    } catch (error_) {
      const error = error_ as RequestError

      if (isRegistryCancellation(error)) {
        throw error
      }
      errors.push(`${source}: ${error.message}`)
    }
  }
  const domains = changed ? [] : previousDomains

  if (changed) {
    const seen = new Set<string>()

    for (const names of [cache.primary, cache.custom, cache.backend]) {
      await forEachBatch(names.length, (start, end) => {
        for (let index = start; index < end; index++) {
          const domain = names[index]

          if (!seen.has(domain)) {
            seen.add(domain)
            domains.push(domain)
          }
        }
      })
    }
  }
  const state = domains.length > 0 ? 'ready' : 'empty'

  if (errors.length === 0 && cacheChanged) {
    cache.updatedAt = Date.now()
  }
  await setRegistryState({
    ...(changed || !domainsRevision ? { domains } : {}),
    ...(cacheChanged ? { registryCache: cache } : {}),
    registryRegionCode: countryCode,
    registryStatus: {
      state: errors.length > 0 ? 'unavailable' : state,
      skipped,
      error: errors.join('; '),
    },
  })
  if (errors.length > 0) {
    throw new Error(errors.join('; '))
  }
}

let syncQueue = Promise.resolve()

export const synchronizeInBackground = (options: SynchronizeOptions = {}) => {
  const operation = async () => {
    if (!await hasDataConsent()) {
      throw new ConsentRequiredError()
    }
    const { syncRegistry = true, syncProxy = true, region } = options
    const mirrors = await getServiceMirrors()
    const failures: string[] = []
    const run = async (name: string, task: () => Promise<unknown>) => {
      try {
        await task()
      } catch (error_) {
        const error = error_ as RequestError

        if (isRegistryCancellation(error)) {
          throw error
        }
        failures.push(`${name}: ${error.message}`)
        console.error(`[Service] ${name}: ${error.message}`)
      }
    }

    await browser.storage.local.remove('serviceRouteError')
    if (region) {
      const { registryRegionCode, localConfig = {} } =
        await browser.storage.local.get(['registryRegionCode', 'localConfig'])
      const previousRegion = registryRegionCode || localConfig.countryCode

      await setRegistryState({
        currentRegionCode: region.countryCode,
        currentRegionName: region.countryName,
        ...(region.countryCode && region.countryCode !== previousRegion ? {
          domains: [], registryRegionCode: region.countryCode,
        } : {}),
      })
      await ProxyManager.setProxy()
    }
    if (syncProxy) {
      await run('Proxy list', () => fetchProxy(mirrors))
    }
    if (syncRegistry) {
      // Remember the previous region before replacing diagnostic configuration.
      const { localConfig = {}, registryRegionCode } =
        await browser.storage.local.get(['localConfig', 'registryRegionCode'])

      if (!registryRegionCode && localConfig.countryCode) {
        await browser.storage.local.set({
          registryRegionCode: localConfig.countryCode,
        })
      }
      const config = await fetchConfig(mirrors)

      await run('Registry', () => fetchRegistry(config, mirrors))
      await run('External registry', () => refreshRegistrySource({ automatic: true }))
      await run('ORI', async () => {
        const { data } = await requestMirroredService(mirrors, 'ori', validORI)

        await browser.storage.local.set({ disseminators: data! })
      })
    }
    if (region) {
      await ProxyManager.setProxy()
    }
    const { serviceRouteError } = await browser.storage.local.get('serviceRouteError')

    if (serviceRouteError) {
      failures.push(serviceRouteError)
    }
    await browser.storage.local.set({
      serviceErrors: failures,
      backendIsIntermittent: false,
    })
  }
  const result = syncQueue.then(operation)

  syncQueue = result.catch(() => {})
  return result
}

export const synchronize = (options: SynchronizeOptions = {}) => {
  return callBackground('synchronize', options)
}

export default { synchronize }
