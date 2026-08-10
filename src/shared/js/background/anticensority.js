import { toSecondLevel } from './pac'
import { fetchWithTimeout } from './utilities'

/**
 * The Anticensority blocklist as an optional extra source of blocked domains.
 *
 * The Anticensority project publishes its blocklist inside a PAC script rather
 * than as a list. The script packs hostnames into one string per name length —
 * so a bucket keyed "6" is every six-character hostname written end to end —
 * which its own binary search then slices apart. Unpacking is therefore just
 * chunking each bucket by its key, with no need to run the script.
 *
 * The list is large: at the time of writing it holds ~660k hostnames. Since
 * this extension's PAC matches on the second-level domain only, names are
 * folded to that form on import, which both removes entries that could never
 * have matched and cuts the list down considerably. It is still big enough to
 * be worth an explicit choice by the user, which is why nothing here runs on
 * its own.
 */

export const ANTICENSORITY_PAC_URLS = [
  'https://anticensority.github.io/generated-pac-scripts/anticensority.pac',
  'https://raw.githubusercontent.com/anticensority/generated-pac-scripts/master/anticensority.pac',
]

// The published script is ~12 MB. The cap leaves room for it to grow without
// letting a redirected or hostile URL exhaust memory in a service worker.
const MAX_BYTES = 48 * 1024 * 1024

const INPUTS_MARKER = 'const inputs = '

/**
 * Pulls the packed input object out of the PAC source.
 *
 * It is emitted as a single-line JSON literal, so the line is taken whole and
 * parsed — no attempt is made to interpret the surrounding program.
 * @param {string} text - PAC script source.
 * @returns {object|null}
 */
export const extractPackedInputs = (text) => {
  if (typeof text !== 'string') {
    return null
  }

  const start = text.indexOf(INPUTS_MARKER)

  if (start === -1) {
    return null
  }

  const from = start + INPUTS_MARKER.length
  const lineEnd = text.indexOf('\n', from)
  const line = (lineEnd === -1 ? text.slice(from) : text.slice(from, lineEnd))
    .trim()
    .replace(/;$/, '')

  try {
    return JSON.parse(line)
  } catch (error) {
    console.warn(`Could not parse the packed blocklist: ${error}`)
    return null
  }
}

/**
 * Unpacks the length-keyed hostname buckets into second-level domains.
 * @param {object} inputs - Parsed packed inputs.
 * @returns {Array<string>} De-duplicated second-level domains.
 */
export const unpackHostnames = (inputs) => {
  const buckets = (inputs && inputs.HOSTNAMES) || {}
  const domains = new Set()

  for (const [key, blob] of Object.entries(buckets)) {
    const width = Number(key)

    // A bucket whose blob does not divide evenly by its key is not in the
    // format this understands; slicing it anyway would invent domains.
    if (!Number.isInteger(width) || width <= 0 ||
        typeof blob !== 'string' || blob.length % width !== 0) {
      console.warn(`Skipping malformed blocklist bucket "${key}".`)
      continue
    }

    for (let offset = 0; offset < blob.length; offset += width) {
      const domain = toSecondLevel(blob.slice(offset, offset + width))

      if (domain) {
        domains.add(domain)
      }
    }
  }

  return [...domains]
}

/**
 * Downloads and unpacks the blocklist from the first mirror that answers.
 * @param {{timeout?: number}} [options]
 * @returns {Promise<{domains: Array<string>, source: string, reason: string}>}
 *   `reason` is '' on success, 'unreachable' when no mirror answered, or
 *   'unparsable' when one did but not with a list this understands.
 */
export const fetchAnticensorityBlocklist = async ({ timeout = 60000 } = {}) => {
  let reason = 'unreachable'

  for (const url of ANTICENSORITY_PAC_URLS) {
    try {
      const response = await fetchWithTimeout(url, { timeout, cache: 'no-store' })

      if (!response.ok) {
        continue
      }

      const size = Number(response.headers.get('content-length'))

      if (Number.isFinite(size) && size > MAX_BYTES) {
        console.warn(`Blocklist at ${url} is too large (${size} bytes).`)
        continue
      }

      const domains = unpackHostnames(extractPackedInputs(await response.text()))

      if (domains.length > 0) {
        return { domains, source: url, reason: '' }
      }
      reason = 'unparsable'
    } catch (error) {
      console.warn(`Blocklist mirror ${url} failed: ${error}`)
    }
  }

  return { domains: [], source: '', reason }
}
