import { isConsentError } from './data-consent'
import type { RegistryResponse } from './request'
import { isRecord, requestError } from './value'

export interface RegistryCache {
  url: string
  etag: string
  finalUrl: string
}

export const isRegistryCancellation = (error: unknown): boolean =>
  isConsentError(error) || (isRecord(error) && (error.name === 'AbortError' ||
    (error.name !== 'TimeoutError' && Boolean(error.cause) &&
      isRegistryCancellation(error.cause))))

// Metadata is committed by the caller only after the body is validated.
export const requestRegistry = async <T>(url: string, cache: Partial<RegistryCache> | null | undefined, request: (method: 'HEAD' | 'GET') => Promise<RegistryResponse<T>>, signal?: AbortSignal) => {
  const checkAborted = () => {
    if (signal?.aborted) {
      throw requestError('Registry request cancelled', { name: 'AbortError' })
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
  const { data, etag = '', finalUrl = '' } = result

  // A GET with metadata always returns its body and headers.
  if (data === undefined) {
    throw requestError('Registry response has no data', {
      code: 'invalid-response',
    })
  }
  return { ...result, data, cache: { url, finalUrl, etag } }
}
