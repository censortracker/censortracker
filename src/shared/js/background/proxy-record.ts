import { parseProxyAddress, proxyProtocols } from './proxy-address'
import { isRecord, isStringArray } from './value'

interface ProxyCredentials {
  username?: string
  password?: string
}
interface ProxyEndpoint {
  protocol: string
  host: string
  port: number
}
export interface ProxyRecord extends ProxyEndpoint, ProxyCredentials {
  id: string
  name?: string
  provider?: 'antizapret'
  restricted?: boolean
  retryAt?: number
  exitCountry?: string
  countryExpiresAt?: number
  checking?: boolean
}

// The managed proxy has no endpoint before its first successful sync.
export type ManagedProxy = Omit<ProxyRecord, 'host' | 'port'> &
  Partial<ProxyEndpoint>

export const MAX_PROXIES = 5000
const protocolAliases: Partial<Record<string, string>> = {
  PROXY: 'HTTP', SOCKS: 'SOCKS4',
}

export const newProxyId = () => Array.from(
  crypto.getRandomValues(new Uint8Array(16)),
  (byte) => byte.toString(16).padStart(2, '0'),
).join('')

export const proxyKey = ({ protocol, host, port }: ProxyEndpoint) => `${protocol} ${host}:${port}`

export const hasProxyAuth = (proxy: ProxyCredentials) =>
  Boolean(proxy.username || proxy.password)

export const hasEndpoint = (proxy: ManagedProxy): proxy is ProxyRecord =>
  Boolean(proxy.host && proxy.port)

export const proxyAuthSupported = (
  proxy: ProxyCredentials & { protocol: string },
  isFirefox: boolean) =>
  !hasProxyAuth(proxy) || proxy.protocol === 'HTTP' ||
  proxy.protocol === 'HTTPS' || (isFirefox && proxy.protocol === 'SOCKS5')

export const validateProxy = (input: unknown): ProxyRecord => {
  if (!isRecord(input) ||
    typeof input.id !== 'string' || !/^[a-z0-9-]{1,80}$/i.test(input.id) ||
    input.id === 'builtin' || typeof input.host !== 'string' ||
    typeof input.port !== 'number' || !Number.isInteger(input.port) ||
    typeof input.protocol !== 'string' || !proxyProtocols.includes(input.protocol)) {
    throw new Error('Invalid proxy')
  }
  const protocol = protocolAliases[input.protocol] || input.protocol
  const address = input.host.includes(':') && !input.host.startsWith('[')
    ? `[${input.host}]` : input.host
  const { host, port } = parseProxyAddress(`${address}:${input.port}`)
  const name = input.name === undefined ? `${protocol} ${host}:${port}` : input.name

  if (typeof name !== 'string' || !name.trim() || name.length > 100) {
    throw new Error('Invalid proxy name')
  }
  if (input.restricted !== undefined && typeof input.restricted !== 'boolean') {
    throw new Error('Invalid proxy restriction')
  }
  if (input.provider !== undefined && input.provider !== 'antizapret') {
    throw new Error('Invalid proxy provider')
  }
  const limit = protocol === 'SOCKS5' ? 255 : 1024
  const credential = (value: unknown): value is string =>
    // eslint-disable-next-line no-control-regex
    typeof value === 'string' && !/[\u{0}-\u{1F}\u{7F}]/u.test(value) &&
    new TextEncoder().encode(value).length <= limit
  const username = input.username === undefined ? '' : input.username
  const password = input.password === undefined ? '' : input.password

  if (!credential(username) || !credential(password)) {
    throw new Error('Invalid proxy credentials')
  }
  const credentials = { username, password }

  if ((['HTTP', 'HTTPS'].includes(protocol) &&
    credentials.username.includes(':')) || (hasProxyAuth(credentials) &&
    (protocol === 'SOCKS4' || (protocol === 'SOCKS5' &&
      (!credentials.username || !credentials.password))))) {
    throw new Error('Invalid proxy credentials for protocol')
  }
  return {
    id: input.id,
    name: name.trim(),
    protocol,
    host,
    port,
    ...(input.provider ? { provider: input.provider } : {}),
    ...(input.restricted || input.provider ? { restricted: true } : {}),
    ...(hasProxyAuth(credentials) ? credentials : {}),
  }
}

export const validateProxyList = (proxies: unknown) => {
  if (!Array.isArray(proxies) || proxies.length > MAX_PROXIES) {
    throw new Error('Invalid proxy list')
  }
  const result = proxies.map(validateProxy)

  if (new Set(result.map(({ id }) => id)).size !== result.length ||
    new Set(result.map(proxyKey)).size !== result.length) {
    throw new Error('Duplicate proxy')
  }
  return result
}

export const proxyStateFromSettings = (settings: {
  proxies?: unknown;
  selectedProxyIds?: unknown;
  customProxyServerURI?: unknown;
  customProxyProtocol?: unknown;
  useOwnProxy?: unknown
}) => {
  let proxies: unknown = settings.proxies
  let selectedProxyIds: unknown = settings.selectedProxyIds

  if (proxies === undefined || proxies === null) {
    const legacy: ProxyRecord[] = []

    proxies = legacy
    if (settings.customProxyServerURI && settings.customProxyProtocol) {
      try {
        legacy.push(validateProxy({
          id: 'legacy',
          protocol: settings.customProxyProtocol,
          ...parseProxyAddress(settings.customProxyServerURI),
        }))
      } catch (error) {
        // A bad legacy endpoint must not select a different proxy.
      }
    }
    if (selectedProxyIds === undefined || selectedProxyIds === null) {
      selectedProxyIds = settings.customProxyServerURI &&
        settings.useOwnProxy !== false
        ? legacy.map(({ id }) => id) : ['builtin']
    }
  }
  const records = validateProxyList(proxies)
  const available = new Set(['builtin', ...records.map(({ id }) => id)])

  selectedProxyIds = selectedProxyIds ?? ['builtin']
  if (!isStringArray(selectedProxyIds) ||
    selectedProxyIds.length > MAX_PROXIES + 1 ||
    selectedProxyIds.some((id) => !available.has(id))) {
    throw new Error('Invalid proxy selection')
  }
  return {
    proxies: records,
    selectedProxyIds: Array.from(new Set(selectedProxyIds)),
  }
}
