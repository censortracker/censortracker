import { isConsentError } from './data-consent'
import type { RequestError } from './value'

export interface RegistryCache {
  url: string
  etag: string
  finalUrl: string
}
export interface RegistryResponse<T = string> {
  data?: T
  etag?: string
  finalUrl?: string
}

export const isRegistryCancellation = (error: unknown): boolean =>
  isConsentError(error) ||
  (error as RequestError | null)?.name === 'AbortError' ||
  Boolean((error as RequestError | null)?.name !== 'TimeoutError' &&
    (error as RequestError | null)?.cause &&
    isRegistryCancellation((error as RequestError).cause))

// Metadata is committed by the caller only after the body is validated.
export const requestRegistry = async <T>(url: string, cache: Partial<RegistryCache> | null | undefined, request: (method: 'HEAD' | 'GET') => Promise<RegistryResponse<T>>, signal?: AbortSignal) => {
  const checkAborted = () => {
    if (signal?.aborted) {
      throw Object.assign(new Error('Registry request cancelled'), { name: 'AbortError' })
    }
  }

  checkAborted()
  if (cache?.url === url && cache.etag) {
    try {
      const result = await request('HEAD')

      checkAborted()

      if (result.etag === cache.etag && result.finalUrl === cache.finalUrl) {
        return { unchanged: true as const }
      }
    } catch (error) {
      if (isRegistryCancellation(error)) {
        throw error
      }
    }
  }
  checkAborted()
  const result = await request('GET')

  return {
    ...result, cache: { url, finalUrl: result.finalUrl!, etag: result.etag! },
  }
}
