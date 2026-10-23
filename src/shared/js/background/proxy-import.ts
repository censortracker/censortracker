import { isPrivateHost } from './private-host'
import { parseProxyAddress } from './proxy-address'
import { MAX_PROXIES, newProxyId, proxyKey, validateProxy } from './proxy-record'

export const MAX_IMPORT_BYTES = 32 * 1024 * 1024

export const parseProxyInput = (input: string, defaultProtocol = 'HTTPS') => {
  let address = input.trim()
  const scheme = address.match(/^([a-z0-9]+):\/\//i)
  const protocol = scheme?.[1]?.toUpperCase() ?? defaultProtocol
  let username = ''
  let password = ''

  if (scheme) {
    address = address.slice(scheme[0].length).replace(/\/$/, '')
  }
  const separator = address.lastIndexOf('@')

  if (separator >= 0) {
    const credentials = address.slice(0, separator)
    const colon = credentials.indexOf(':')

    username = decodeURIComponent(
      colon < 0 ? credentials : credentials.slice(0, colon),
    )
    password = colon < 0 ? '' : decodeURIComponent(credentials.slice(colon + 1))
    address = address.slice(separator + 1)
  }
  const endpoint = parseProxyAddress(address)

  return validateProxy({
    id: newProxyId(),
    protocol,
    username,
    password,
    ...endpoint,
  })
}

// Read string literals only. Imported PAC programs are never executed.
function * pacStrings (text: string) {
  for (let index = 0; index < text.length; index++) {
    if (text.slice(index, index + 2) === '//') {
      const end = text.indexOf('\n', index + 2)

      index = end < 0 ? text.length : end
      continue
    }
    if (text.slice(index, index + 2) === '/*') {
      const end = text.indexOf('*/', index + 2)

      index = end < 0 ? text.length : end + 1
      continue
    }
    const quote = text[index]

    if (quote !== '"' && quote !== '\'') {
      continue
    }
    let value = ''

    while (++index < text.length && text[index] !== quote) {
      if (text[index] === '\\') {
        index++
        const code = text[index]
        let digits = 0

        if (code === 'u') {
          digits = 4
        } else if (code === 'x') {
          digits = 2
        }
        const hex = text.slice(index + 1, index + 1 + digits)

        if (digits && hex.length === digits && /^[0-9a-f]+$/i.test(hex)) {
          value += String.fromCharCode(parseInt(hex, 16))
          index += digits
        } else {
          // Whitespace escapes all separate PAC directives.
          value += code && 'nrt'.includes(code) ? ' ' : code || ''
        }
      } else {
        value += text[index]
      }
    }
    if (index < text.length) {
      yield value
    }
  }
}

export const parseProxyImport = (text: unknown, {
  protocol = 'HTTPS', pac = false, limit = MAX_PROXIES,
} = {}) => {
  if (typeof text !== 'string' || text.length > MAX_IMPORT_BYTES ||
    new TextEncoder().encode(text).length > MAX_IMPORT_BYTES ||
    !Number.isInteger(limit) || limit < 1 || limit > MAX_PROXIES) {
    throw new Error('Invalid or oversized proxy list')
  }
  // Code must not fall through to unrestricted address parsing. Quotes in
  // plain proxy credentials must be percent-encoded.
  const fromPac = pac || /\bFindProxyForURL\b/.test(text) ||
    /^(?![^\S\r\n]*(?:#|\/\/))[^\r\n]*[{}"'`]/m.test(text)
  const proxies = []
  const seen = new Set()
  let skipped = 0
  let truncated = false
  let candidates = 0
  const tokens = function * importTokens () {
    if (fromPac) {
      for (const literal of pacStrings(text)) {
        for (const match of literal.matchAll(/\b(PROXY|HTTPS|SOCKS5|SOCKS4|SOCKS)\s+([^;\s]+)/g)) {
          yield `${match[1]}://${match[2]}`
        }
      }
    } else {
      for (const [line] of text.matchAll(/[^\r\n]+/g)) {
        if (/^\s*(#|\/\/)/.test(line)) {
          continue
        }
        for (const [token] of line.matchAll(/[^\s,;]+/g)) {
          yield token
        }
      }
    }
  }

  for (const token of tokens()) {
    if (++candidates > MAX_PROXIES * 2) {
      truncated = true
      break
    }
    try {
      const proxy = parseProxyInput(token, protocol)
      const key = proxyKey(proxy)

      if (seen.has(key) || (fromPac && isPrivateHost(proxy.host))) {
        skipped++
        continue
      }
      if (proxies.length === limit) {
        truncated = true
        break
      }
      seen.add(key)
      proxies.push({ ...proxy, ...(fromPac ? { restricted: true } : {}) })
    } catch (error) {
      skipped++
    }
  }
  return { proxies, skipped, truncated, fromPac }
}
