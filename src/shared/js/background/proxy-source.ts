import { normalizeHostname } from './hostname'
import { proxyProtocols } from './proxy-address'

export interface Subscription {
  id: string
  url: string
  protocol: string
}

export const validateSourceUrl = (value: unknown) => {
  if (typeof value !== 'string' || value.length > 4096 || /\s/.test(value)) {
    throw new Error('Invalid source URL')
  }
  const url = new URL(value)

  if (!['http:', 'https:'].includes(url.protocol) || url.username ||
    url.password || url.hash || !normalizeHostname(url.hostname)) {
    throw new Error('Invalid source URL')
  }
  return url.href
}

export const validateSubscriptions = (input: unknown): Subscription[] => {
  if (!Array.isArray(input) || input.length > 20) {
    throw new Error('Invalid subscriptions')
  }
  const sources = input.map((source) => {
    if (!source || !/^[a-z0-9-]{1,80}$/i.test(source.id) ||
      typeof source.id !== 'string' || !proxyProtocols.includes(source.protocol)) {
      throw new Error('Invalid subscription')
    }
    return {
      id: source.id,
      url: validateSourceUrl(source.url),
      protocol: source.protocol,
    }
  })

  if (new Set(sources.map(({ id }) => id)).size !== sources.length ||
    new Set(sources.map(({ url }) => url)).size !== sources.length) {
    throw new Error('Duplicate subscription')
  }
  return sources
}
