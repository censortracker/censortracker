import { normalizeHostname } from './hostname'

export interface DomainIndexData {
  lists: Record<string, string>[]
  count: number
}
export interface DomainIndex {
  data: DomainIndexData
  has(host: string): boolean
}

// PAC can search these strings without allocating one Set entry per domain.
export const createDomainIndex = (data: string[] | DomainIndexData) => {
  if (Array.isArray(data)) {
    return new Set(data)
  }
  return {
    data,
    has: (host: string) => {
      const width = host.length

      for (const buckets of data.lists) {
        const bucket = buckets[width] || ''
        let low = 0
        let high = bucket.length / width - 1

        while (low <= high) {
          const middle = Math.floor((low + high) / 2)
          const name = bucket.slice(middle * width, (middle + 1) * width)

          if (name === host) {
            return true
          }
          if (name < host) {
            low = middle + 1
          } else {
            high = middle - 1
          }
        }
      }
      return false
    },
  }
}

export const buildDomainIndex = async (names: string[],
  current = () => true) => {
  const buckets: Record<string, string[]> = {}

  for (let offset = 0; offset < names.length; offset++) {
    const host = normalizeHostname(names[offset])

    if (host) {
      (buckets[host.length] ||= []).push(host)
    }
    if (offset > 0 && offset % 2000 === 0) {
      await new Promise((resolve) => setTimeout(resolve, 0))
      if (!current()) {
        return null
      }
    }
  }
  const joined: Record<string, string> = {}

  for (const width of Object.keys(buckets)) {
    joined[width] = buckets[width].sort().join('')
    await new Promise((resolve) => setTimeout(resolve, 0))
    if (!current()) {
      return null
    }
  }
  return { lists: [joined], count: names.length }
}
