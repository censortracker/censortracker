import browser from './browser-api'
import { withDataConsent } from './data-consent'
import { findHostMatch } from './host-match'
import { normalizeHostname } from './hostname'
import ProxyManager from './proxy'
import {
  getServiceRoute, mustUseDirect, proxyAllowed, restoreServiceRoute,
  setServiceRoute, withProxyLock,
} from './proxy-route'
import type { RegistryCache } from './registry-request'
import { isRegistryCancellation, requestRegistry } from './registry-request'
import type { RegistryResponse } from './request'
import { requestFailure, watchRequest } from './request-diagnostics'
import type { StorageChanges, StorageState } from './storage'
import { errorMessage, isRecord, requestError } from './value'

export type Validator<T> = (data: unknown) => data is T
export interface ServiceOptions {
  allowProxyRetry?: boolean
  maxRedirects?: number
  requireEnabled?: boolean
  cache?: Partial<RegistryCache>
}
type AttemptResult<T> = RegistryResponse<T> & { redirectUrl?: string | null }
export interface ServiceData<T> {
  unchanged?: false
  data: T
  etag?: string
  finalUrl?: string
  viaProxy?: boolean
  cache?: RegistryCache
}
// Only a request with a cached validator can return «unchanged».
export type ServiceResponse<T> = { unchanged: true } | ServiceData<T>
const proxyRouteKeys: (keyof StorageState)[] = [
  'ignoredHosts', 'siteCountryRules', 'proxies', 'selectedProxyIds',
  'proxyChecks', 'proxyFailures', 'useLocalProxy', 'localProxyAlive',
  'localProxyURI', 'proxyServerURI', 'customProxyServerURI',
  'customProxyProtocol', 'useOwnProxy', 'antizapret',
]

const siteChoice = async (hostname: string) => {
  if (await mustUseDirect(hostname)) {
    return 'never'
  }
  const { customProxiedDomains } = await browser.storage.local.get({
    customProxiedDomains: [],
  })

  const names = new Set(customProxiedDomains.map(normalizeHostname))

  return findHostMatch(hostname, names) ? 'always' : 'auto'
}

const proxyRoute = async (hostname: string) => {
  if (!await proxyAllowed()) {
    throw new Error('Proxy use is disabled or unavailable')
  }
  if (await mustUseDirect(hostname)) {
    throw new Error('Proxy request blocked by an exclusion or a private host')
  }
  const decision = await ProxyManager.getServiceProxyRoute(hostname)

  if (decision.type !== 'proxy') {
    throw new Error('No eligible proxy: check selection, health, and country rules')
  }
  return decision.route.replace(/;.*/s, '').trim()
}

const attemptRequest = async <T>(
  url: string,
  validate: Validator<T>,
  viaProxy: boolean,
  allowRedirects: boolean,
  requireEnabled: boolean,
  method: string,
  metadata: boolean,

  controller: AbortController,
): Promise<AttemptResult<T>> => {
  const parsed = new URL(url)
  const { hostname } = parsed

  parsed.hash = ''
  let abortReason = ''
  let stage = 'route check'
  let redirectUrl: string | undefined
  let requestId: string | undefined
  let headersReceived!: () => void
  const headersReady = new Promise<void>((resolve) => {
    headersReceived = resolve
  })
  const onHeadersReceived = (
    details: browser.webRequest._OnHeadersReceivedDetails &
      { initiator?: string },
  ) => {
    const initiator = details.initiator ||
      details.originUrl || details.documentUrl || ''

    if (details.url !== parsed.href ||
      !`${initiator}/`.startsWith(browser.runtime.getURL('')) ||
      (requestId && details.requestId !== requestId)) {
      return
    }
    requestId = details.requestId
    if ([301, 302, 303, 307, 308].includes(details.statusCode)) {
      redirectUrl = details.responseHeaders?.find((header) =>
        header.name.toLowerCase() === 'location')?.value
    }
    headersReceived()
  }
  const timeout = setTimeout(() => {
    abortReason = 'Timeout after 60 seconds'
    controller.abort()
  }, 60000)
  const onSettingsChanged = (changes: StorageChanges) => {
    if (changes.enableExtension?.newValue === false ||
      changes.useProxy?.newValue === false || changes.customProxiedDomains ||
      (viaProxy && proxyRouteKeys.some((key) => changes[key]))) {
      abortReason = 'Cancelled because routing settings changed'
      controller.abort()
    }
  }

  browser.storage.onChanged.addListener(onSettingsChanged)
  const stop = watchRequest(url, method)

  try {
    if (requireEnabled) {
      const { enableExtension } = await browser.storage.local.get('enableExtension')

      if (!enableExtension) {
        throw new Error('Extension is disabled')
      }
    }
    if (viaProxy) {
      if (await proxyRoute(hostname) !== getServiceRoute()?.route) {
        throw new Error('Proxy route changed before the request')
      }
    } else if (await siteChoice(hostname) === 'always') {
      throw new Error('Direct request blocked by the always-proxy rule')
    }
    if (controller.signal.aborted) {
      throw new Error(abortReason)
    }
    stage = 'fetch'
    if (allowRedirects) {
      controller.signal.addEventListener('abort', headersReceived, { once: true })
      browser.webRequest.onHeadersReceived.addListener(onHeadersReceived, {
        urls: [`${parsed.protocol}//${parsed.hostname}/*`],
        types: ['xmlhttprequest'],
      }, ['responseHeaders'])
    }
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      cache: 'no-store',
      redirect: allowRedirects ? 'manual' : 'error',
    })

    if (controller.signal.aborted) {
      throw new Error(abortReason)
    }
    if (allowRedirects && (response.type === 'opaqueredirect' ||
      [301, 302, 303, 307, 308].includes(response.status))) {
      await headersReady
      if (controller.signal.aborted) {
        throw new Error(abortReason)
      }
      return { redirectUrl: redirectUrl || response.headers?.get('location') }
    }
    if (!response.ok) {
      throw requestError(`HTTP ${response.status}`, {
        httpStatus: response.status,
      })
    }
    const headers = metadata || method === 'HEAD' ? {
      etag: response.headers?.get('etag') || '', finalUrl: url,
    } : {}

    if (method === 'HEAD') {
      return headers
    }
    stage = 'JSON parsing'
    const data: unknown = await response.json()

    stage = 'response validation'
    if (controller.signal.aborted) {
      throw new Error(abortReason)
    }
    if (!validate(data)) {
      throw new Error('Response does not match the expected service data')
    }
    return { data, ...headers }
  } catch (error) {
    clearTimeout(timeout)
    await stop(error)
    const netError = isRecord(error) && typeof error.netError === 'string'
      ? error.netError : ''
    const failure = new Error(`${stage}: ${abortReason || netError || errorMessage(error)}`, { cause: error })

    if (abortReason.startsWith('Timeout')) {
      failure.name = 'TimeoutError'
    }
    if (abortReason.startsWith('Cancelled')) {
      failure.name = 'AbortError'
    }
    throw failure
  } finally {
    await stop()
    clearTimeout(timeout)
    browser.storage.onChanged.removeListener(onSettingsChanged)
    if (allowRedirects) {
      controller.signal.removeEventListener('abort', headersReceived)
      browser.webRequest.onHeadersReceived.removeListener(onHeadersReceived)
    }
  }
}

const attempt = <T>(...args: [string,
  Validator<T>,
  boolean,
  boolean,
  boolean,
  string,
  boolean]) => {
  const controller = new AbortController()

  return withDataConsent(() => attemptRequest(...args, controller), controller)
}

const requestDirect = async <T>(
  url: string,
  validate: Validator<T>,
  allowRedirects: boolean,
  requireEnabled: boolean,
  method: string,
  metadata: boolean,

) => {
  const setting = browser.proxy.settings
  const { levelOfControl } = await setting.get({})
  let direct = false

  if (await proxyAllowed()) {
    direct = await setServiceRoute(new URL(url).hostname, 'DIRECT')
  } else if (levelOfControl === 'controlled_by_this_extension') {
    await setting.clear({})
  }
  let routeChanged = false
  const onRouteChange = () => {
    routeChanged = true
  }

  setting.onChange?.addListener(onRouteChange)
  try {
    const before = await setting.get({})
    const result = await attempt(
      url, validate, false, allowRedirects, requireEnabled, method, metadata,
    )
    const after = await setting.get({})
    const knownDirect = ['direct', 'none'].includes(
      before.value.mode || before.value.proxyType || '',
    ) || (direct && before.levelOfControl === 'controlled_by_this_extension')

    return {
      ...result,
      viaProxy: !knownDirect || routeChanged ||
        before.levelOfControl !== after.levelOfControl ||
        JSON.stringify(before.value) !== JSON.stringify(after.value),
    }
  } finally {
    setting.onChange?.removeListener(onRouteChange)
  }
}

const requestProxy = async <T>(
  url: string,
  validate: Validator<T>,
  allowRedirects: boolean,
  requireEnabled: boolean,
  method: string,
  metadata: boolean,

) => {
  const hostname = new URL(url).hostname

  await proxyRoute(hostname)
  await ProxyManager.pingInBackground()
  const route = await proxyRoute(hostname)

  if (!await setServiceRoute(hostname, route)) {
    throw new Error('Proxy request cannot preserve existing browser routes')
  }
  return {
    ...await attempt(
      url, validate, true, allowRedirects, requireEnabled, method, metadata,
    ),
    viaProxy: true,
  }
}

const requestHop = async <T>(
  url: string,
  validate: Validator<T>,
  allowProxyRetry: boolean,
  allowRedirects: boolean,
  requireEnabled: boolean,

  method: string, metadata: boolean,
) => {
  let directError
  const choice = await siteChoice(new URL(url).hostname)

  if (choice === 'always' && !allowProxyRetry) {
    throw new Error('DIRECT: blocked by the always-proxy rule')
  }
  if (choice !== 'always') {
    try {
      return await requestDirect(
        url, validate, allowRedirects, requireEnabled, method, metadata,
      )
    } catch (error) {
      if (isRegistryCancellation(error)) {
        throw error
      }
      directError = new Error(`DIRECT: ${errorMessage(error)}`, { cause: error })
      const { httpStatus } = requestFailure(error)

      if (httpStatus === 404 || httpStatus === 410) {
        throw directError
      }
    }
    if (!allowProxyRetry) {
      throw directError
    }
    if (choice === 'never') {
      throw new Error(`${directError.message}; proxy retry blocked by an exclusion or a private host`, {
        cause: directError,
      })
    }
  }
  try {
    return await requestProxy(
      url, validate, allowRedirects, requireEnabled, method, metadata,
    )
  } catch (error) {
    const errors = [directError?.message, `PROXY: ${errorMessage(error)}`]

    throw new Error(errors.filter(Boolean).join('; '), { cause: error })
  }
}

const requestRoute = <T>(
  url: string, validate: Validator<T>, {
    allowProxyRetry = true, maxRedirects = 0, requireEnabled = false,
  }: Omit<ServiceOptions, 'cache'>, method: string, metadata: boolean,
) => {
  const parsed = new URL(url)
  const endpoint = `${parsed.origin}${parsed.pathname}`

  return withProxyLock(async () => {
    const visited = new Set()
    let viaProxy = false

    try {
      for (let hops = 0; ; hops++) {
        const current = new URL(url)

        current.hash = ''
        if (!['http:', 'https:'].includes(current.protocol)) {
          throw new Error('Service request requires HTTP or HTTPS')
        }
        if (visited.has(current.href)) {
          throw new Error('Redirect cycle')
        }
        visited.add(current.href)
        const result = await requestHop(
          url, validate, allowProxyRetry, maxRedirects > 0, requireEnabled,
          method, metadata,
        )

        viaProxy ||= result.viaProxy
        if (!('redirectUrl' in result)) {
          return { ...result, viaProxy }
        }
        if (hops >= maxRedirects) {
          throw new Error(`Redirect limit exceeded: maximum ${maxRedirects} hops`)
        }
        if (!result.redirectUrl) {
          throw new Error('Redirect has no Location header')
        }
        url = new URL(result.redirectUrl, current).href
      }
    } finally {
      try {
        await restoreServiceRoute()
      } catch (error) {
        await browser.storage.local.set({
          serviceRouteError: `${endpoint}: route restoration failed: ${errorMessage(error)}`,
        })
      }
    }
  }).catch((error: unknown) => {
    throw new Error(`${endpoint}: ${errorMessage(error)}`, { cause: error })
  })
}

export function requestService<T> (url: string, validate: Validator<T>,
  options?: ServiceOptions & { cache?: undefined }): Promise<ServiceData<T>>
export function requestService<T> (url: string, validate: Validator<T>,
  options?: ServiceOptions): Promise<ServiceResponse<T>>
export function requestService<T> (url: string, validate: Validator<T>,
  { cache, ...options }: ServiceOptions = {}): Promise<ServiceResponse<T>> {
  if (cache) {
    return requestRegistry(url, cache,
      (method) => requestRoute(url, validate, options, method, true))
  }
  return requestRoute(url, validate, options, 'GET', false).then((result) => {
    // A GET without a redirect always returns validated data.
    if (result.data === undefined) {
      throw new Error('Response does not match the expected service data')
    }
    return { ...result, data: result.data }
  })
}
