import { withDataConsent } from './data-consent'
import type { RegistryResponse } from './registry-request'
import { watchRequest } from './request-diagnostics'
import type { RequestError } from './value'

export interface RequestOptions extends RequestInit {
  timeout?: number
  maxBytes?: number
  metadata?: boolean
}

// Keep the deadline active until the entire response has been read.
const readText = async (url: string, {
  timeout = 15000, signal, maxBytes = 32 * 1024 * 1024,
  metadata = false, ...options
}: RequestOptions = {}, controller: AbortController) => {
  const abort = () => controller.abort()
  let timedOut = false
  const stop = watchRequest(url, options.method)
  const timer = setTimeout(() => {
    timedOut = true
    abort()
  }, timeout)

  if (signal) {
    signal.addEventListener('abort', abort, { once: true })
  }
  if (signal?.aborted) {
    abort()
  }
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      credentials: 'omit',
      ...options,
      signal: controller.signal,
    })

    if (!response.ok) {
      throw Object.assign(new Error(`HTTP ${response.status}`), {
        httpStatus: response.status,
      })
    }
    const headers = { etag: response.headers?.get('etag') || '', finalUrl: response.url || url }

    if (options.method === 'HEAD') {
      return headers
    }
    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let size = 0
    let text = ''

    while (true) {
      const { done, value } = await reader.read()

      if (done) {
        text += decoder.decode()
        return metadata ? { data: text, ...headers } : text
      }
      size += value.byteLength
      if (size > maxBytes) {
        throw Object.assign(new Error('Response is too large'), {
          code: 'invalid-response',
        })
      }
      text += decoder.decode(value, { stream: true })
    }
  } catch (error_) {
    const error = error_ as RequestError

    clearTimeout(timer)
    await stop(error)
    if (timedOut) {
      throw Object.assign(new Error('Request aborted by timeout'), {
        name: 'TimeoutError',
      })
    }
    throw error
  } finally {
    stop()
    clearTimeout(timer)
    if (signal) {
      signal.removeEventListener('abort', abort)
    }
    abort()
  }
}

export function requestText (url: string,
  options: RequestOptions & { metadata: true }): Promise<RegistryResponse>
export function requestText (url: string,
  options?: RequestOptions & { metadata?: false }): Promise<string>
export function requestText (url: string,
  options?: RequestOptions): Promise<string | RegistryResponse> {
  const controller = new AbortController()

  return withDataConsent(() => readText(url, options, controller), controller)
}
