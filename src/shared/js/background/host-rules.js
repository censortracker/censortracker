/**
 * How a destination host is classified, in one place.
 *
 * Two of the functions below — `isPrivateHost` and `isIgnoredHost` — are
 * special: `getPacScript()` embeds their *source* into the generated PAC via
 * `Function.prototype.toString()`, while `site-rules.js` imports and calls them
 * directly. One definition therefore drives both the routing decision the
 * browser makes and every place that reports it, so the two can never drift.
 *
 * That embedding imposes one rule on them: they must be entirely
 * self-contained. Every helper and constant they need has to live inside the
 * body, because a reference to a module-scope binding would survive
 * `toString()` as a name that does not exist inside the PAC — and the
 * production build mangles those names anyway. They also have to stay within
 * what a PAC sandbox provides: plain JavaScript, no `console`, no `URL`.
 */

const isAscii = (value) => {
  // eslint-disable-next-line no-control-regex
  return !/[^\u0000-\u007F]/.test(value)
}

/**
 * Converts an internationalized host to its Punycode (ASCII) form.
 *
 * The URL parser does the IDNA work, so no punycode dependency is needed. A
 * value the parser rejects is returned unchanged when it is already ASCII, and
 * dropped when it is not — an unconvertible Unicode entry could only poison
 * the PAC.
 * @param domain {string} Host, possibly internationalized.
 * @returns {string} ASCII host, or '' when the value is unusable.
 */
export const toPunycode = (domain) => {
  if (typeof domain !== 'string' || !domain) {
    return ''
  }

  if (isAscii(domain)) {
    return domain
  }

  try {
    const { hostname } = new URL(`http://${domain}`)

    return isAscii(hostname) ? hostname : ''
  } catch (error) {
    return ''
  }
}

/**
 * True when a host can only ever exist on the machine or the local network.
 *
 * Such a destination is unreachable through a remote proxy by definition: the
 * proxy would resolve the name, or route the address, on *its* network. Sending
 * one through a proxy is exactly how a router's admin page, a NAS or a printer
 * stops opening until the extension is switched off.
 *
 * SELF-CONTAINED — see the note at the top of this file before editing.
 * @param host {string} Destination host, with or without IPv6 brackets.
 * @returns {boolean}
 */
export function isPrivateHost (host) {
  // '192.168.1.1' -> [192, 168, 1, 1]; null for anything that is not a dotted
  // quad. Written out because parseInt() alone accepts '1e2', '0x10' and
  // trailing rubbish, any of which would let a public address read as private.
  function octetsOf (literal) {
    const parts = literal.split('.')

    if (parts.length !== 4) {
      return null
    }

    const octets = []

    for (let index = 0; index < 4; index += 1) {
      const part = parts[index]

      if (part.length === 0 || part.length > 3) {
        return null
      }

      for (let position = 0; position < part.length; position += 1) {
        const code = part.charCodeAt(position)

        if (code < 48 || code > 57) {
          return null
        }
      }

      const octet = parseInt(part, 10)

      if (octet > 255) {
        return null
      }
      octets.push(octet)
    }
    return octets
  }

  let name = String(host || '').toLowerCase()

  // Depending on the caller an IPv6 literal arrives bracketed or bare, and a
  // host may carry the root's trailing dot. Strip both so one spelling is left.
  if (name.charAt(0) === '[' && name.charAt(name.length - 1) === ']') {
    name = name.substring(1, name.length - 1)
  }

  while (name.charAt(name.length - 1) === '.') {
    name = name.substring(0, name.length - 1)
  }

  if (!name) {
    return true
  }

  // A host name cannot contain a colon, so anything that does is an IPv6
  // literal and can be read as one.
  if (name.indexOf(':') !== -1) {
    if (name === '::' || name === '::1') {
      return true
    }

    // An IPv4-mapped address (::ffff:192.168.0.1) is still that IPv4 address.
    if (name.indexOf('::ffff:') === 0) {
      name = name.substring(7)
    } else {
      const group = name.split(':')[0]

      if (!/^[\da-f]{1,4}$/.test(group)) {
        return false
      }

      const prefix = parseInt(group, 16)

      // fc00::/7 unique-local and fe80::/10 link-local.
      return (prefix >= 0xFC00 && prefix <= 0xFDFF) ||
        (prefix >= 0xFE80 && prefix <= 0xFEBF)
    }
  }

  const octets = octetsOf(name)

  if (octets) {
    const first = octets[0]
    const second = octets[1]

    return first === 0 || // 0.0.0.0/8, "this network"
      first === 10 || // 10.0.0.0/8
      first === 127 || // loopback
      (first === 100 && second >= 64 && second <= 127) || // CGNAT 100.64.0.0/10
      (first === 169 && second === 254) || // link-local, incl. cloud metadata
      (first === 172 && second >= 16 && second <= 31) || // 172.16.0.0/12
      (first === 192 && second === 168) || // 192.168.0.0/16
      (first === 198 && (second === 18 || second === 19)) || // benchmarking
      first >= 224 // multicast, reserved, broadcast
  }

  // A single-label name ('router', 'nas') is resolved on the local network —
  // the same answer the PAC built-in isPlainHostName() gives.
  if (name.indexOf('.') === -1) {
    return true
  }

  // Suffixes reserved for local networks or for documentation. Nobody on the
  // public internet can resolve them, so a proxy could not reach them either.
  const localSuffixes = [
    '.local',
    '.localhost',
    '.localdomain',
    '.home',
    '.home.arpa',
    '.lan',
    '.internal',
    '.intranet',
    '.corp',
    '.private',
    '.test',
    '.invalid',
  ]

  for (let index = 0; index < localSuffixes.length; index += 1) {
    const suffix = localSuffixes[index]

    if (name.length > suffix.length &&
        name.substring(name.length - suffix.length) === suffix) {
      return true
    }
  }
  return false
}

/**
 * True when the user put this host on the "Ignored sites" list.
 *
 * An entry covers its subdomains, so ignoring `example.com` also ignores
 * `cdn.example.com` — which is what someone listing a site to keep off the
 * proxy means. Labels are walked rather than the list scanned, so the cost does
 * not grow with the length of the list.
 *
 * SELF-CONTAINED — see the note at the top of this file before editing.
 * @param host {string} Destination host.
 * @param index {Object|null} Map of ignored host -> 1, from buildIgnoreIndex().
 * @returns {boolean}
 */
export function isIgnoredHost (host, index) {
  if (!index) {
    return false
  }

  let name = String(host || '').toLowerCase()

  if (name.charAt(0) === '[' && name.charAt(name.length - 1) === ']') {
    name = name.substring(1, name.length - 1)
  }

  while (name.charAt(name.length - 1) === '.') {
    name = name.substring(0, name.length - 1)
  }

  if (!name) {
    return false
  }

  if (Object.prototype.hasOwnProperty.call(index, name)) {
    return true
  }

  // An address literal has no parent domain, and walking one's labels would let
  // an entry like "1.1" swallow every 192.168.1.1 on the planet.
  if (name.indexOf(':') !== -1) {
    return false
  }

  const parts = name.split('.')

  // No real suffix is all digits, so an all-digit last label means IPv4.
  if (/^\d+$/.test(parts[parts.length - 1])) {
    return false
  }

  for (let depth = 1; depth < parts.length; depth += 1) {
    const parent = parts.slice(depth).join('.')

    if (Object.prototype.hasOwnProperty.call(index, parent)) {
      return true
    }
  }
  return false
}

/**
 * The blocklist entry that covers this host, or '' when none does.
 *
 * The list is matched by suffix rather than by truncating the host to its last
 * two labels, which is what the PAC used to do. That truncation quietly lost
 * two whole classes of entry:
 *
 *   - Anything under a multi-label public suffix. The list stores what tldts
 *     calls the registrable domain, so a blocked site is `example.co.uk`, while
 *     truncation turned `www.example.co.uk` into `co.uk` and compared that —
 *     never a match, for any site under .co.uk, .com.br, .org.uk and the rest.
 *   - Any entry deeper than two labels. An imported list naming
 *     `cdn.example.com` matched nothing at all, silently.
 *
 * The walk stops before a bare public suffix: an entry of `com` or `uk` could
 * only come from a malformed list, and honouring it would put the whole
 * internet through the proxy.
 *
 * SELF-CONTAINED — see the note at the top of this file before editing.
 * @param host {string} Destination host.
 * @param lookup {Function} Answers whether one exact name is on the list.
 * @returns {string} The matching entry, or ''.
 */
export function matchBlockedSuffix (host, lookup) {
  let candidate = String(host || '')

  while (candidate) {
    if (lookup(candidate)) {
      return candidate
    }

    const dot = candidate.indexOf('.')

    if (dot === -1) {
      return ''
    }

    const rest = candidate.substring(dot + 1)

    if (rest.indexOf('.') === -1) {
      return ''
    }
    candidate = rest
  }
  return ''
}

/**
 * Reduces anything a user might type or paste into a bare host.
 *
 * The "Ignored sites" editor is a free-text box, so entries arrive as full
 * URLs, with a port, with a `*.` in front, or with the case they happened to be
 * copied in. All of those name a host, and all of them have to end up in the
 * one form the routing code compares against.
 * @param value {string}
 * @returns {string} Bare lower-case host, or '' when the value names none.
 */
export const normalizeHostEntry = (value) => {
  if (typeof value !== 'string') {
    return ''
  }

  let entry = value.trim().toLowerCase()

  if (!entry || entry.startsWith('#')) {
    return ''
  }

  // Strip a scheme, then everything that is not the authority.
  entry = entry.replace(/^[a-z][a-z0-9+.-]*:\/\//, '')
  entry = entry.split('/')[0].split('?')[0].split('#')[0]

  const credentials = entry.lastIndexOf('@')

  if (credentials !== -1) {
    entry = entry.substring(credentials + 1)
  }

  if (entry.startsWith('[')) {
    // Bracketed IPv6, optionally with a port after the closing bracket.
    const close = entry.indexOf(']')

    entry = close === -1 ? entry.substring(1) : entry.substring(1, close)
  } else {
    // A single colon is a port; several mean a bare IPv6 literal, which has no
    // port to strip.
    const colon = entry.indexOf(':')

    if (colon !== -1 && entry.indexOf(':', colon + 1) === -1) {
      entry = entry.substring(0, colon)
    }
  }

  // "*.example.com" and ".example.com" both mean "example.com and below",
  // which is how an entry already behaves.
  entry = entry.replace(/^\*\./, '').replace(/^\.+/, '').replace(/\.+$/, '')

  if (!entry) {
    return ''
  }

  // Reject anything left that cannot be a host, so a stray line in the editor
  // does not become an entry that silently matches nothing.
  const ascii = toPunycode(entry)

  if (!ascii || !/^[a-z0-9._:-]+$/.test(ascii)) {
    return ''
  }
  return ascii
}

/**
 * Normalizes a whole list, dropping blanks and duplicates but keeping order.
 *
 * Deliberately NOT `removeDuplicates()` from utilities: that one keeps only
 * what tldts recognizes as a registrable domain, which is null for every IP
 * literal and every single-label host. Running an ignore list through it threw
 * away exactly the addresses it exists to protect.
 * @param entries {Array<string>} Raw lines, URLs or hosts.
 * @returns {Array<string>} Bare hosts.
 */
export const normalizeHostList = (entries) => {
  const seen = new Set()

  for (const entry of Array.isArray(entries) ? entries : []) {
    const host = normalizeHostEntry(entry)

    if (host) {
      seen.add(host)
    }
  }
  return [...seen]
}

/**
 * Builds the lookup `isIgnoredHost()` consumes, in the ASCII form the PAC sees.
 * @param entries {Array<string>} Raw "Ignored sites" list.
 * @returns {Object<string, number>} Map of host -> 1.
 */
export const buildIgnoreIndex = (entries) => {
  const index = {}

  for (const host of normalizeHostList(entries)) {
    index[host] = 1
  }
  return index
}
