import { normalizeHostname } from './hostname'
import { isPrivateHost } from './private-host'
import { validateSourceUrl } from './proxy-source'
import type { RegistryCache } from './registry-request'
import { isRecord } from './value'

export interface RegistrySource {
  kind: 'custom' | 'anticensority'
  url: string
  enabled: boolean
  autoUpdate: boolean
}
export interface ExternalRegistry {
  source: string
  domains: string[]
  updatedAt: number
  cache?: RegistryCache
}

export const registrySourceDefaults: RegistrySource = {
  kind: 'custom', url: '', enabled: false, autoUpdate: false,
}
export const registrySourceUrls = {
  anticensority: 'https://raw.githubusercontent.com/anticensority/generated-pac-scripts/master/anticensority.pac',
}
export const MAX_REGISTRY_BYTES = 32 * 1024 * 1024

export const validateRegistrySource = (source: unknown): RegistrySource => {
  if (!isRecord(source) ||
    (source.kind !== 'custom' && source.kind !== 'anticensority') ||
    typeof source.enabled !== 'boolean' ||
    typeof source.autoUpdate !== 'boolean' || typeof source.url !== 'string') {
    throw new TypeError('Invalid registry source')
  }
  const url = source.url === '' ? '' : validateSourceUrl(source.url)

  if (source.kind !== 'custom' && url !== registrySourceUrls[source.kind as keyof typeof registrySourceUrls]) {
    throw new TypeError('Invalid registry provider URL')
  }
  if (!url && (source.enabled || source.autoUpdate)) {
    throw new TypeError('A registry source URL is required')
  }
  return {
    kind: source.kind,
    url,
    enabled: source.enabled,
    autoUpdate: source.autoUpdate,
  }
}

export const registrySourceKey = (source: RegistrySource) => JSON.stringify([
  source.kind, source.url,
])

export const externalRegistryDomains = ({
  registrySource,
  externalRegistry,
}: {
  registrySource?: RegistrySource;
  externalRegistry?: ExternalRegistry | null
}) =>
  registrySource?.enabled &&
  externalRegistry?.source === registrySourceKey(registrySource)
    ? externalRegistry.domains : []

export const normalizeRegistryDomains = async (
  input: unknown, signal?: AbortSignal, { skipInvalid = false } = {},
) => {
  if (!Array.isArray(input) || input.length === 0 || input.length > 1000000) {
    throw new TypeError('Invalid registry list')
  }
  const domains = new Set<string>()

  for (let index = 0; index < input.length; index++) {
    if (signal?.aborted) {
      throw new Error('Registry download cancelled')
    }
    const entry = input[index]

    const bare = typeof entry === 'string' && entry.length <= 253 &&
      !/[\s/\\@?#%]/.test(entry) &&
      (!entry.includes(':') || /^\[[0-9a-f:.]+\]$/i.test(entry))
    const host = bare ? normalizeHostname(entry) : null

    if (!host && !skipInvalid) {
      throw new TypeError('Invalid registry hostname')
    }
    if (host && !isPrivateHost(host)) {
      domains.add(host)
    }
    if (index > 0 && index % 2000 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
  }
  if (domains.size === 0) {
    throw new TypeError('Empty registry list')
  }
  return Array.from(domains)
}

export const parseRegistryList = (text: unknown, signal?: AbortSignal) => {
  if (typeof text !== 'string' || text.length > MAX_REGISTRY_BYTES) {
    throw new TypeError('Invalid registry response')
  }
  const input = text.trim()
  let domains

  if (input.startsWith('[') || input.startsWith('{')) {
    const value = JSON.parse(input)

    domains = Array.isArray(value) ? value : value.domains
  } else {
    domains = input.split(/\r?\n/).map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && !line.startsWith('//'))
  }
  return normalizeRegistryDomains(domains, signal)
}
