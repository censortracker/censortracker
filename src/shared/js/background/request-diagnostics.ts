import browser from './browser-api'
import { isRecord } from './value'

const active = new Set<{ url: string; method: string; ambiguous: boolean }>()
const nativeCode = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^(net::ERR_[A-Z0-9_]+|NS_[A-Z0-9_]+)$/.test(value)

// Only observe this extension's request. Overlapping matches are ambiguous.
export const watchRequest = (url: string, method = 'GET') => {
  const before = browser.webRequest?.onBeforeRequest
  const failed = browser.webRequest?.onErrorOccurred

  if (!before || !failed || !browser.runtime?.getURL) {
    return () => {}
  }
  const target = new URL(url)

  target.hash = ''
  const entry = { url: target.href, method, ambiguous: false }

  for (const other of active) {
    if (other.url === entry.url && other.method === method) {
      other.ambiguous = true
      entry.ambiguous = true
    }
  }
  active.add(entry)
  let requestId: string | undefined
  let netError: string | undefined
  let finish: (() => void) | undefined
  const onBefore = (
    details: browser.webRequest._OnBeforeRequestDetails &
      { initiator?: string },
  ) => {
    const origin = details.initiator || details.originUrl || ''

    if (details.url !== entry.url || details.method !== method ||
      !`${origin}/`.startsWith(browser.runtime.getURL(''))) {
      return
    }
    if (requestId && requestId !== details.requestId) {
      entry.ambiguous = true
    }
    requestId = details.requestId
  }
  const onError = (details: browser.webRequest._OnErrorOccurredDetails) => {
    if (requestId && details.requestId === requestId &&
      nativeCode(details.error)) {
      netError = details.error
      finish?.()
    }
  }
  const filter = { urls: [`${target.protocol}//${target.hostname}/*`] }
  const release = () => {
    before.removeListener(onBefore)
    failed.removeListener(onError)
    active.delete(entry)
  }
  const stop = async (error?: unknown) => {
    // Chromium can reject fetch before it dispatches onErrorOccurred.
    if (isRecord(error) && error.name === 'TypeError' && !netError &&
      !entry.ambiguous) {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 50)

        finish = () => {
          clearTimeout(timer)
          resolve()
        }
      })
    }
    release()
    if (isRecord(error) && netError && !entry.ambiguous) {
      error.netError = netError
    }
  }

  try {
    before.addListener(onBefore, filter)
    failed.addListener(onError, filter)
  } catch {
    release()
  }
  return stop
}

export const requestFailure = (error: unknown): {
  code: string;
  netError?: string;
  httpStatus?: number
} => {
  for (let cause = error; isRecord(cause); cause = cause.cause) {
    if (cause.name === 'TimeoutError') {
      return { code: 'timeout' }
    }
    if (typeof cause.httpStatus === 'number' &&
      Number.isInteger(cause.httpStatus)) {
      return { code: 'http', httpStatus: cause.httpStatus }
    }
    if (cause.code === 'invalid-response' || cause.name === 'SyntaxError') {
      return { code: 'invalid-response' }
    }
    if (nativeCode(cause.netError)) {
      return { code: 'network', netError: cause.netError }
    }
  }
  return { code: 'network' }
}
