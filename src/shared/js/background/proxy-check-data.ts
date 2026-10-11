import { normalizeHostname } from './hostname'
import { isPrivateHost } from './private-host'
import type { ProxyRecord } from './proxy-record'

export interface CheckAttempt {
  service: string
  code: string
  netError?: string
  httpStatus?: number
}
export interface ProxyCheck {
  fingerprint: string
  checkedAt: number
  status: string
  attempts?: CheckAttempt[]
  latency?: number
  exitIP?: string
  exitCountry?: string
  serverIP?: string
  serverCountry?: string
}
export interface ProxyFailure {
  fingerprint: string
  retryAt: number
}
export interface ProxyCheckRun {
  running: boolean
  total?: number
  completed?: number
  cancelled?: boolean
}

export const CHECK_URLS = [
  'https://api.ipify.org/?format=json',
  'https://api.myip.com/',
  'https://ipwho.is/',
  'https://api.country.is/',
]

const services = new Set(CHECK_URLS.map((url) => new URL(url).hostname))
const codes = new Set([
  'ok', 'timeout', 'network', 'http', 'invalid-response', 'auth', 'route-setup',
])

// Export only fixed service names and diagnostic codes, never raw errors.
export const checkAttempts = (check?: { attempts?: CheckAttempt[] }) =>
  Array.isArray(check?.attempts)
    ? check.attempts.slice(0, 2).filter((attempt) =>
      services.has(attempt?.service) && codes.has(attempt?.code))
      .map(({ service, code, netError, httpStatus }) => ({
        service,
        code,
        ...(typeof netError === 'string' &&
        /^(net::ERR_[A-Z0-9_]+|NS_[A-Z0-9_]+)$/.test(netError) ? { netError } : {}),
        ...(Number.isInteger(httpStatus) && httpStatus! >= 100 &&
        httpStatus! <= 599
          ? { httpStatus } : {}),
      })) : []

export const publicIP = (value: unknown) => {
  if (typeof value !== 'string' || !/^[0-9a-f:.[\]]+$/i.test(value) ||
    (!value.includes(':') && !/^\d+\.\d+\.\d+\.\d+$/.test(value))) {
    return ''
  }
  const host = normalizeHostname(value.includes(':') && !value.startsWith('[')
    ? `[${value}]` : value)

  return host && (/^\d+\.\d+\.\d+\.\d+$/.test(host) || host.startsWith('[')) &&
    !isPrivateHost(host) ? host.replace(/^\[|\]$/g, '') : ''
}

export const countryCode = (value: unknown) => typeof value === 'string' &&
  /^[A-Z]{2}$/.test(value) && !['XX', 'ZZ'].includes(value) ? value : ''

// Bind runtime results to the endpoint and credentials, not the editable name.
const fingerprints = new Map<string, { data: string; value: string }>()

export const proxyFingerprint = async (proxy: ProxyRecord) => {
  const data = JSON.stringify([
    proxy.protocol, proxy.host, proxy.port, proxy.username || '', proxy.password || '',
  ])
  const cached = fingerprints.get(proxy.id)

  if (cached?.data === data) {
    return cached.value
  }
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(data))
  const value = Array.from(new Uint8Array(hash), (byte) =>
    byte.toString(16).padStart(2, '0')).join('')

  if (fingerprints.size >= 5001) {
    fingerprints.clear()
  }
  fingerprints.set(proxy.id, { data, value })
  return value
}

export const currentProxyCheck = async <T extends { fingerprint: string }>(
  proxy: ProxyRecord,
  checks: Record<string,
    T>) => {
  const result = checks[proxy.id]

  return result && result.fingerprint === await proxyFingerprint(proxy)
    ? result : null
}
