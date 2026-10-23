import { parseProxyAddress } from './proxy-address'
import { MAX_PROXIES } from './proxy-record'
import { validateSourceUrl } from './proxy-source'
import { registrySourceUrls } from './registry-source-data'
import { isRecord } from './value'

const forkKeys = [
  'customProxies', 'proxyChain', 'activeCustomProxyId', 'proxyAllTraffic',
  'useCustomRegistry', 'customRegistryUrl', 'useExternalBlocklist', 'proxySources',
]
const protocolFromFork = (value: unknown) => {
  if (typeof value !== 'string' || value.length > 16) {
    throw new TypeError('Invalid fork proxy protocol')
  }
  const protocol = value.trim().toUpperCase().replace(/[:/]+$/, '')

  return protocol === 'SOCKS' ? 'SOCKS5' : protocol
}
const decodeCredential = (value: string) => {
  try {
    return decodeURIComponent(value)
  } catch (error) {
    // The fork also accepts literal percent signs in credentials.
    return value
  }
}

// Convert user choices only. The common validator checks the result.
export const settingsFromFork = (input: Record<string, unknown>) => {
  if (input.proxies !== undefined || input.selectedProxyIds !== undefined ||
    !forkKeys.some((key) => Object.prototype.hasOwnProperty.call(input, key))) {
    return input
  }
  const result = { ...input }

  for (const key of ['proxyAllTraffic', 'useCustomRegistry', 'useExternalBlocklist']) {
    if (input[key] !== undefined && typeof input[key] !== 'boolean') {
      throw new TypeError('Invalid fork setting')
    }
  }
  if (input.proxyAllTraffic !== undefined) {
    result.proxyAll = input.proxyAllTraffic
  }
  if (input.customProxyProtocol !== undefined) {
    result.customProxyProtocol = protocolFromFork(input.customProxyProtocol)
  }
  const proxies = input.customProxies === undefined ? [] : input.customProxies
  const chain = input.proxyChain
  const active = input.activeCustomProxyId

  if (!Array.isArray(proxies) || proxies.length > MAX_PROXIES ||
    (chain != null && (!Array.isArray(chain) ||
      chain.length > MAX_PROXIES + 1)) ||
    (active !== undefined && (typeof active !== 'string' || active.length > 64))) {
    throw new TypeError('Invalid fork proxy selection')
  }
  const ids = new Map([['builtin', 'builtin']])
  const converted = proxies.map((proxy: unknown, index) => {
    if (!isRecord(proxy) || typeof proxy.id !== 'string' ||
      !/^[\w-]{1,64}$/.test(proxy.id) || ids.has(proxy.id)) {
      throw new TypeError('Invalid fork proxy ID')
    }
    const id = `fork-${index}`
    const credentials = proxy.credentials === undefined ? '' : proxy.credentials

    if (typeof credentials !== 'string' || credentials.length > 16384) {
      throw new TypeError('Invalid fork proxy credentials')
    }
    const colon = credentials.indexOf(':')

    ids.set(proxy.id, id)
    return {
      id,
      name: proxy.name === '' ? undefined : proxy.name,
      protocol: protocolFromFork(proxy.protocol),
      ...parseProxyAddress(proxy.uri),
      username: decodeCredential(
        colon < 0 ? credentials : credentials.slice(0, colon),
      ),
      password: colon < 0 ? '' : decodeCredential(credentials.slice(colon + 1)),
      restricted: proxy.restricted,
    }
  })

  // Without a list or a saved chain, retain the original single-proxy migration.
  if (converted.length > 0 || chain != null || active) {
    const selection = chain ?? (active ? [active] : [])

    result.proxies = converted
    const selected = selection.map((id: unknown) => {
      if (typeof id !== 'string' || !ids.has(id)) {
        throw new TypeError('Unknown fork proxy ID')
      }
      return ids.get(id)
    })

    result.selectedProxyIds = input.useOwnProxy === true ? selected : ['builtin']
  }
  if (input.customRegistryUrl !== undefined) {
    result.registrySource = {
      kind: 'custom',
      url: input.customRegistryUrl === '' ? '' : validateSourceUrl(input.customRegistryUrl),
      enabled: false,
      autoUpdate: false,
    }
  }
  if (input.useExternalBlocklist === true &&
    (input.useCustomRegistry !== true ||
      !((result.registrySource as { url?: string } | undefined)?.url))) {
    result.registrySource = {
      kind: 'anticensority',
      url: registrySourceUrls.anticensority,
      enabled: false,
      autoUpdate: false,
    }
  }
  if (input.proxySources !== undefined) {
    if (!Array.isArray(input.proxySources) || input.proxySources.length > 20) {
      throw new TypeError('Invalid fork proxy sources')
    }
    result.proxySubscriptions = Array.from(new Set(
      input.proxySources.map(validateSourceUrl),
    ), (url, index) => ({ id: `fork-source-${index}`, url, protocol: 'HTTPS' }))
  }
  return result
}
