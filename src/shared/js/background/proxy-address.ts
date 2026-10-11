import { normalizeHostname } from './hostname'

const protocols: Record<string, string> = {
  HTTP: 'PROXY',
  PROXY: 'PROXY',
  HTTPS: 'HTTPS',
  SOCKS: 'SOCKS',
  SOCKS4: 'SOCKS4',
  SOCKS5: 'SOCKS5',
}

export const proxyProtocols = Object.keys(protocols)

export const parseProxyAddress = (address: unknown) => {
  if (typeof address !== 'string' || address.length > 300) {
    throw new Error('Invalid proxy address')
  }
  const match = /^(\[[0-9a-f:.]+\]|[^\s:;/\\@?#%'"`]+):(\d{1,5})$/i.exec(address)

  if (!match || Number(match[2]) < 1 || Number(match[2]) > 65535) {
    throw new Error('Invalid proxy address')
  }
  const host = normalizeHostname(match[1])
  const port = Number(match[2])

  if (!host) {
    throw new Error('Invalid proxy address')
  }
  return { host, port }
}

export const proxyDirective = (protocol: string, address: unknown) => {
  if (!Object.prototype.hasOwnProperty.call(protocols, protocol)) {
    throw new Error('Invalid proxy protocol')
  }
  const { host, port } = parseProxyAddress(address)

  return `${protocols[protocol]} ${host}:${port}`
}
