import browser from './browser-api'
import type { StorageChanges } from './storage'
import { isRecord } from './value'

export interface Consent { version: number; accepted: boolean }

export const CONSENT_VERSION = 1
export const validConsent = (value: unknown): value is Consent =>
  isRecord(value) && value.version === CONSENT_VERSION &&
  typeof value.accepted === 'boolean'
export const consentAccepted = (value: unknown) =>
  validConsent(value) && value.accepted
export const getDataConsent = async () => {
  const { dataConsent } = await browser.storage.local.get('dataConsent')

  return validConsent(dataConsent) ? dataConsent : null
}
export const hasDataConsent = async () =>
  consentAccepted(await getDataConsent())

export class ConsentRequiredError extends Error {
  constructor () {
    super('Data transmission consent is required')
    this.name = 'ConsentRequiredError'
  }
}

export const isConsentError = (error: unknown): boolean => isRecord(error) &&
  (error.name === 'ConsentRequiredError' ||
    Boolean(error.cause && isConsentError(error.cause)))

// Keep the listener active until the response body has also been read.
export const withDataConsent = async <T>(
  operation: (signal: AbortSignal) => Promise<T>,
  controller = new AbortController(),

) => {
  let revoked = false
  const changed = (changes: StorageChanges, area: string) => {
    if (area === 'local' && changes.dataConsent &&
      !consentAccepted(changes.dataConsent.newValue)) {
      revoked = true
      controller.abort()
    }
  }

  browser.storage.onChanged.addListener(changed)
  try {
    if (!await hasDataConsent() || revoked) {
      throw new ConsentRequiredError()
    }
    if (controller.signal.aborted) {
      throw new Error('Request cancelled')
    }
    const result = await operation(controller.signal)

    if (revoked) {
      throw new ConsentRequiredError()
    }
    return result
  } catch (error) {
    if (revoked) {
      throw new ConsentRequiredError()
    }
    throw error
  } finally {
    browser.storage.onChanged.removeListener(changed)
  }
}
