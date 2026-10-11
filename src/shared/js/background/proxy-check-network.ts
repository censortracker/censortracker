import { isPrivateHost } from './private-host'
import { countryCode, publicIP } from './proxy-check-data'
import type { ProxyRecord } from './proxy-record'
import type { RequestOptions } from './request'
import { requestText } from './request'

interface CheckResponse {
  ip?: unknown
  success?: boolean
  country_code?: unknown
  cc?: unknown
  country?: unknown
  Answer?: { type: number; data: string }[]
}
export interface ProbeResult {
  latency: number
  exitIP: string
  exitCountry: string
}

export { CHECK_URLS } from './proxy-check-data'

export const CHECK_TIMEOUT = 8000

const json = async (url: string,
  signal: AbortSignal,
  options: RequestOptions & { metadata?: false } = {
  }): Promise<CheckResponse> => JSON.parse(
  await requestText(url, {
    timeout: CHECK_TIMEOUT, maxBytes: 65536, redirect: 'error', signal, ...options,
  }),
)

export const probeProxy = async (url: string, signal: AbortSignal) => {
  const started = performance.now()
  const data = await json(url, signal)
  const exitIP = publicIP(data?.ip)

  if (!exitIP || data.success === false) {
    throw Object.assign(new Error('Invalid IP check response'), {
      code: 'invalid-response',
    })
  }
  return {
    latency: Math.round(performance.now() - started),
    exitIP,
    exitCountry: countryCode(data.country_code || data.cc || data.country),
  }
}

let nextLookup = 0
const lookup = async (url: string,
  signal: AbortSignal,
  options: RequestOptions & { metadata?: false } = {
  }) => {
  const start = Math.max(Date.now(), nextLookup)

  nextLookup = start + 200
  await new Promise<void>((resolve) => {
    const finish = () => {
      clearTimeout(timer)
      signal.removeEventListener('abort', finish)
      resolve()
    }
    const timer = setTimeout(finish, start - Date.now())

    signal.addEventListener('abort', finish, { once: true })
    if (signal.aborted) {
      finish()
    }
  })
  return json(url, signal, { timeout: 5000, ...options })
}

export const locateProxy = async <T extends ProbeResult>(proxy: ProxyRecord,
  result: T,
  signal: AbortSignal) => {
  let serverIP = publicIP(proxy.host)
  let serverCountry = ''
  let exitCountry = result.exitCountry

  try {
    if (!serverIP && !isPrivateHost(proxy.host!)) {
      // Resolve only the proxy endpoint, never a visited site's hostname.
      for (const type of ['A', 'AAAA']) {
        const dns = await lookup(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(proxy.host!)}&type=${type}`,
          signal, { headers: { accept: 'application/dns-json' } })

        serverIP = (dns.Answer || []).filter((answer) =>
          answer.type === (type === 'A' ? 1 : 28)).map((answer) => publicIP(answer.data))
          .find(Boolean) || ''
        if (serverIP) {
          break
        }
      }
    }
    if (serverIP) {
      const data = await lookup(`https://api.country.is/${encodeURIComponent(serverIP)}`, signal)

      if (publicIP(data.ip) === serverIP) {
        serverCountry = countryCode(data.country)
      }
    }
  } catch (error) {
    // A location service failure does not make a working proxy unavailable.
  }
  if (!exitCountry && !signal.aborted) {
    try {
      const data = await lookup(`https://api.country.is/${encodeURIComponent(result.exitIP)}`, signal)

      if (publicIP(data.ip) === result.exitIP) {
        exitCountry = countryCode(data.country)
      }
    } catch (error) {
      // Unknown location remains unknown.
    }
  }
  return { ...result, serverIP, serverCountry, exitCountry }
}
