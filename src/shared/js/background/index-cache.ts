import browser from './browser-api'
import type { DomainIndexData } from './domain-index'
import type { StorageState } from './storage'
import { isRecord } from './value'

// Store each revision in the same write as its source data.
const newRevision = () => crypto.getRandomValues(new Uint32Array(4)).join('-')

export const registryWrites = new Set<(keys: string[]) => void>()

export const setRegistryState = async (state: Partial<StorageState>) => {
  await browser.storage.local.set({
    ...state,
    ...('domains' in state ? { domainsRevision: newRevision() } : {}),
    ...('externalRegistry' in state
      ? { externalRegistryRevision: newRevision() } : {}),
  })
  // Large onChanged events can arrive after the write promise resolves.
  for (const listener of registryWrites) {
    listener(Object.keys(state))
  }
}

const validIndex = (data: unknown): data is DomainIndexData =>
  isRecord(data) && Number.isSafeInteger(data.count) &&
  (data.count as number) >= 0 && Array.isArray(data.lists) &&
  data.lists.length === 1 && isRecord(data.lists[0]) &&
  Object.entries(data.lists[0]).every(([width, names]) =>
    /^[1-9]\d{0,2}$/.test(width) && Number(width) <= 253 &&
    typeof names === 'string' && names.length % Number(width) === 0)

// This is a disposable cache. A failed or blocked transaction is a cache miss.
export const indexCache = (
  key: string, revision: string, data?: DomainIndexData,
): Promise<DomainIndexData | null> => new Promise((resolve) => {
  let database: IDBDatabase | undefined
  let finished = false
  const finish = (result: DomainIndexData | null = null) => {
    finished = true
    clearTimeout(timeout)
    database?.close()
    resolve(result)
  }
  const timeout = setTimeout(() => finish(), 1000)

  try {
    if (!revision) {
      finish()
      return
    }
    const request = indexedDB.open('domain-index-cache', 1)

    request.addEventListener('error', () => finish())
    request.addEventListener('blocked', () => finish())
    request.addEventListener('upgradeneeded', () => {
      request.result.createObjectStore('indexes')
    })
    request.addEventListener('success', () => {
      database = request.result
      database.addEventListener('versionchange', () => database?.close())
      if (finished) {
        database.close()
        return
      }
      try {
        const transaction = database.transaction('indexes',
          data ? 'readwrite' : 'readonly')
        const store = transaction.objectStore('indexes')
        const operation = data
          ? store.put({ version: 1, revision, data }, key) : store.get(key)

        transaction.addEventListener('abort', () => finish())
        transaction.addEventListener('error', () => finish())
        transaction.addEventListener('complete', () => {
          const record = operation.result

          finish(!data && record?.version === 1 &&
            record.revision === revision && validIndex(record.data)
            ? record.data : null)
        })
      } catch {
        finish()
      }
    })
  } catch {
    finish()
  }
})
