import { MAX_REGISTRY_BYTES, normalizeRegistryDomains } from './registry-source-data'
import { isRecord } from './value'

// The publisher stores JSON on one line. Never interpret the surrounding PAC.
export const parseAnticensority = (text: string, signal?: AbortSignal) => {
  if (typeof text !== 'string' || text.length > MAX_REGISTRY_BYTES) {
    throw new TypeError('Invalid Anticensority response')
  }
  const matches = text.matchAll(/^[\t ]*const inputs = (\{[^\r\n]+\});[\t ]*\r?$/gm)
  const json = matches.next().value?.[1]

  if (!json || !matches.next().done) {
    throw new TypeError('Invalid Anticensority data')
  }
  const inputs: unknown = JSON.parse(json)
  const buckets = isRecord(inputs) ? inputs.HOSTNAMES : null

  if (!isRecord(buckets)) {
    throw new TypeError('Invalid Anticensority hostnames')
  }
  const domains: string[] = []

  for (const [key, value] of Object.entries(buckets)) {
    const width = Number(key)

    if (!/^[1-9]\d{0,2}$/.test(key) || width > 253 ||
      typeof value !== 'string' || value.length % width !== 0 ||
      domains.length + value.length / width > 1000000) {
      throw new TypeError('Invalid Anticensority bucket')
    }
    for (let offset = 0; offset < value.length; offset += width) {
      domains.push(value.slice(offset, offset + width))
    }
  }
  // The live list contains malformed names. Do not expand them into host rules.
  return normalizeRegistryDomains(domains, signal, { skipInvalid: true })
}
