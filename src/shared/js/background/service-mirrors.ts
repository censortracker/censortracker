import browser from './browser-api'
import { hasDataConsent } from './data-consent'
import { isRegistryCancellation } from './registry-request'
import {
  CONFIG_URL, DOMAINS_URL, GEOIP_URL, getRegionConfig, ORI_URL, PROXY_LIST_URL,
} from './service-config'
import type { ServiceOptions, Validator } from './service-request'
import { requestService } from './service-request'
import type { RequestError } from './value'

export type ServiceName = 'geoip' | 'ori' | 'proxyList' | 'config' | 'domains'
export type ServiceMirrors = Partial<Record<ServiceName, string[]>> & {
  registry?: Record<string, string[]>
}

export const MIRRORS_URL = 'https://raw.githubusercontent.com/censortracker/censortracker/refs/heads/mirror/mirror_v21.json'
export const MIRRORS_ALARM = 'service-mirrors'
const services = {
  geoip: GEOIP_URL,
  ori: ORI_URL,
  proxyList: PROXY_LIST_URL,
  config: `${CONFIG_URL}{country}/`,
  domains: `${DOMAINS_URL}{country}/`,
}
const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' &&
  !Array.isArray(value)
const hasOwn = (object: object, key: string) =>
  Object.prototype.hasOwnProperty.call(object, key)

const validateUrls = (values: unknown, template = false) => {
  if (!Array.isArray(values)) {
    throw new TypeError('Invalid mirror list')
  }
  return [...new Set(values.map((value) => {
    if (typeof value !== 'string' || /[\s#]/.test(value)) {
      throw new TypeError('Invalid mirror URL')
    }
    const expanded = template ? value.replaceAll('{country}', 'RU') : value

    if (/[{}]/.test(expanded)) {
      throw new TypeError('Invalid mirror template')
    }
    const url = new URL(expanded)

    if (url.protocol !== 'https:' || url.username || url.password) {
      throw new TypeError('Mirror URL requires HTTPS without credentials')
    }
    return value
  }))]
}

const validateRegistryMirrors = (registry: unknown) => {
  if (!isObject(registry)) {
    throw new TypeError('Invalid registry mirrors')
  }
  return Object.fromEntries(Object.entries(registry)
    .filter(([country]) => country === country.toUpperCase() &&
      getRegionConfig(country).registryUrl)
    .map(([country, urls]) => [country, validateUrls(urls)]))
}

export const validateServiceMirrors = (data: unknown): ServiceMirrors => {
  if (!isObject(data) || data.formatVersion !== 1 || !isObject(data.mirrors)) {
    throw new TypeError('Invalid mirrors format')
  }
  const mirrors: ServiceMirrors = {}

  for (const key of (Object.keys(services) as ServiceName[])) {
    if (hasOwn(data.mirrors, key)) {
      mirrors[key] = validateUrls(data.mirrors[key],
        key === 'config' || key === 'domains')
    }
  }
  if (hasOwn(data.mirrors, 'registry')) {
    mirrors.registry = validateRegistryMirrors(data.mirrors.registry)
  }
  return mirrors
}

export const getServiceUrls = (mirrors: ServiceMirrors, service: ServiceName | 'registry', country = '') => {
  const countryCode = country.toUpperCase()
  let builtIn = [services[service as ServiceName]]
  let extra = mirrors[service as ServiceName] || []

  if (service === 'registry') {
    const { registryUrl, registryMirrors } = getRegionConfig(countryCode)

    if (!registryUrl) {
      return []
    }
    builtIn = [registryUrl, ...registryMirrors]
    extra = mirrors.registry?.[countryCode] || []
  }
  return [...new Set([...builtIn, ...extra].map((url) =>
    new URL(url.replaceAll('{country}', countryCode)).href))]
}

export const requestMirroredService = async <T>(
  mirrors: ServiceMirrors, service: ServiceName | 'registry', validate: Validator<T>, { countryCode = '', ...options }: ServiceOptions & { countryCode?: string } = {},
) => {
  const errors = []

  for (const url of getServiceUrls(mirrors, service, countryCode)) {
    try {
      const result = await requestService(url, validate, {
        ...options, ...(service === 'geoip' ? { allowProxyRetry: false } : {}),
      })

      if (service === 'geoip' && result.viaProxy) {
        throw new Error('GeoIP returned the proxy country, not the user country')
      }
      return result
    } catch (error_) {
      const error = error_ as RequestError

      if (isRegistryCancellation(error)) {
        throw error
      }
      errors.push(error.message)
    }
  }
  throw new Error(errors.join('; '))
}

let pending: Promise<void> | null

export const refreshServiceMirrors = () => {
  pending ||= (async () => {
    const { enableExtension = false } =
      await browser.storage.local.get('enableExtension')

    if (!enableExtension || !await hasDataConsent()) {
      return
    }
    const checkedAt = Date.now()

    await browser.storage.local.set({ mirrorsCheckedAt: checkedAt })
    try {
      const { data } = await requestService(
        MIRRORS_URL,
        (value: unknown): value is unknown =>
          Boolean(validateServiceMirrors(value)),
        { requireEnabled: true },

      )

      await browser.storage.local.set({
        serviceMirrors: validateServiceMirrors(data),
        mirrorsUpdatedAt: Date.now(),
        mirrorsError: '',
      })
    } catch (error_) {
      const error = error_ as RequestError

      if (isRegistryCancellation(error)) {
        throw error
      }
      await browser.storage.local.set({ mirrorsError: error.message })
    }
  })().finally(() => {
    pending = null
  })
  return pending
}

export const getServiceMirrors = async () => {
  await pending
  const { serviceMirrors = {} } =
    await browser.storage.local.get('serviceMirrors')

  return serviceMirrors
}

export const scheduleServiceMirrors = async ({ refresh = true } = {}) => {
  const { enableExtension = false } =
    await browser.storage.local.get('enableExtension')

  if (!enableExtension || !await hasDataConsent()) {
    await browser.alarms.clear(MIRRORS_ALARM)
    return
  }
  if ((await browser.alarms.get(MIRRORS_ALARM))?.periodInMinutes !== 60) {
    await browser.alarms.create(MIRRORS_ALARM, { periodInMinutes: 60 })
  }
  if (refresh) {
    await refreshServiceMirrors()
  }
}

export const registerServiceMirrors = () => {
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.enableExtension || changes.dataConsent)) {
      scheduleServiceMirrors().catch(() => {
        console.warn('Could not schedule service mirrors')
      })
    }
  })
  return scheduleServiceMirrors({ refresh: false })
}
