import { isRecord } from './value'

export interface RegionConfig {
  countryCode: string
  registryUrl: string | null
  registryMirrors: string[]
  configSource: string
  customRegistryUrl?: string | null
}
export interface ServiceProxy {
  server: string
  port: string | number
  pingHost: string
  pingPort: string | number
  active: boolean
  weight: number | string
}
export interface Disseminator {
  url: string
  cooperationRefused: boolean
  name?: string
}

export const GEOIP_URL = 'https://geo.ctreserve.de/get-iso/'
export const ORI_URL = 'https://registry.ctreserve.de/api/v3/disseminators/refused/'
export const PROXY_LIST_URL = 'https://cozyquokka.net/api/proxy-list/'
export const CONFIG_URL = 'https://cozyquokka.net/api/config/'
export const DOMAINS_URL = 'https://cozyquokka.net/api/domains/'

export const getRegionConfig = (code: string): RegionConfig => {
  const countryCode = code.toUpperCase()
  const countries = ['AZ', 'BY', 'GE', 'KG', 'KZ', 'TR', 'UA', 'UZ']
  let registryUrl = null

  if (countryCode === 'RU') {
    registryUrl = 'https://registry.ctreserve.de/api/v3/ct-domains/'
  } else if (countries.includes(countryCode)) {
    registryUrl = `https://censortracker.github.io/ctconf/registry/${countryCode.toLowerCase()}.json`
  }
  return {
    countryCode,
    registryUrl,
    registryMirrors: countryCode === 'RU'
      ? ['https://109.61.17.39/api/v3/ct-domains/',
        'https://storage.mwsapis.ru/b-hecqix/ct-domains.json'] : [],
    configSource: 'built-in',
  }
}

export const validCountry = (
  data: unknown,
): data is { countryCode: string } => {
  return isRecord(data) && typeof data.countryCode === 'string' &&
    /^[a-z]{2}$/i.test(data.countryCode)
}

export const validDomain = (domain: unknown): domain is string => typeof domain === 'string' &&
  domain.length > 0 && !/[\s/:;]/.test(domain)

export const validDomains = (data: unknown): data is unknown[] =>
  Array.isArray(data) &&
  (data.length === 0 || data.some(validDomain))

export const validConfig = (
  data: unknown,
): data is { customRegistryUrl?: string | null } =>
  isRecord(data) && (data.customRegistryUrl == null ||
    typeof data.customRegistryUrl === 'string')

export const validCustomRegistry = (
  data: unknown,
): data is { domains: unknown[] }[] =>
  Array.isArray(data) &&
  data.every((record) => isRecord(record) && validDomains(record.domains))

const validDisseminator = (entry: unknown): entry is Disseminator =>
  isRecord(entry) && typeof entry.url === 'string' && entry.url.length > 0 &&
  typeof entry.cooperationRefused === 'boolean'

export const validORI = (data: unknown): data is Disseminator[] =>
  Array.isArray(data) && data.every(validDisseminator)

const validHost = (value: unknown) => {
  return typeof value === 'string' && /^[a-z0-9.-]+$/i.test(value)
}

const validPort = (value: unknown) => {
  return /^\d+$/.test(String(value)) && Number(value) > 0 && Number(value) <= 65535
}

const validProxy = (entry: unknown): entry is ServiceProxy =>
  isRecord(entry) && validHost(entry.server) && validHost(entry.pingHost) &&
  validPort(entry.port) && validPort(entry.pingPort) &&
  typeof entry.active === 'boolean' &&
  Number.isFinite(Number(entry.weight)) && Number(entry.weight) >= 0

export const validProxies = (data: unknown): data is ServiceProxy[] =>
  Array.isArray(data) && data.every(validProxy) &&
  data.some(({ active, weight }) => active && Number(weight) > 0)
