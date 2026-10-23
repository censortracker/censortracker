import browser from './browser-api'
import { parseProxyAddress } from './proxy-address'
import type { ManagedProxy, ProxyRecord } from './proxy-record'
import {
  MAX_PROXIES, newProxyId, proxyKey, proxyStateFromSettings,
  validateProxy, validateProxyList,
} from './proxy-record'
import { isRecord, isStringArray } from './value'

export interface ProxyListState {
  proxies: ProxyRecord[]
  selectedProxyIds: string[]
  builtin: ManagedProxy
  added?: number
  skipped?: number
}
// validateProxy and validateProxyList check the proxy payloads.
export type ProxyListAction = { operation: 'list' } |
  { operation: 'save'; proxy: unknown } |
  { operation: 'append'; proxies: unknown } |
  { operation: 'remove' | 'select'; ids: string[] } |
  { operation: 'toggle'; id: string; selected: boolean }

// Messages are untrusted: keep only the fields of a known operation.
export const proxyListAction = (value: unknown): ProxyListAction => {
  const action: Record<string, unknown> = isRecord(value) ? value : {}
  const { operation, ids, id, selected } = action

  if (operation === 'list') {
    return { operation }
  }
  if (operation === 'save') {
    return { operation, proxy: action.proxy }
  }
  if (operation === 'append') {
    return { operation, proxies: action.proxies }
  }
  if (operation === 'remove') {
    if (!isStringArray(ids)) {
      throw new Error('Cannot remove the managed proxy')
    }
    return { operation, ids }
  }
  if (operation === 'select' && isStringArray(ids)) {
    return { operation, ids }
  }
  if (operation === 'toggle' && typeof id === 'string' &&
    typeof selected === 'boolean') {
    return { operation, id, selected }
  }
  throw new Error(operation === 'select' || operation === 'toggle'
    ? 'Invalid proxy selection' : 'Unknown proxy operation')
}

export const readProxyState = async (): Promise<ProxyListState> => {
  const storage = await browser.storage.local.get({
    proxies: null,
    selectedProxyIds: null,
    customProxyServerURI: null,
    customProxyProtocol: null,
    proxyServerURI: null,
    useOwnProxy: null,
  })
  let builtin: ManagedProxy = {
    id: 'builtin', name: 'Censor Tracker', protocol: 'HTTPS',
  }

  try {
    builtin = { ...builtin, ...parseProxyAddress(storage.proxyServerURI) }
  } catch (error) {
    // The managed endpoint may be unavailable before its first successful sync.
  }
  return { ...proxyStateFromSettings(storage), builtin }
}

// The background caller holds the proxy lock across this write and PAC update.
export const updateProxyList = async (action: ProxyListAction) => {
  const state = await readProxyState()

  if (action.operation === 'list') {
    return state
  }
  if (action.operation === 'save') {
    const proxy = isRecord(action.proxy) ? action.proxy : {}
    const record = validateProxy({ ...proxy, id: proxy.id || newProxyId() })
    const index = state.proxies.findIndex(({ id }) => id === record.id)
    const existing = state.proxies[index]

    if (!existing) {
      state.proxies.push(record)
    } else {
      if (existing.provider) {
        record.provider = existing.provider
        record.restricted = true
      }
      state.proxies[index] = record
    }
  } else if (action.operation === 'append') {
    const seen = new Map(
      state.proxies.map((record) => [proxyKey(record), record]),
    )
    const records = validateProxyList(action.proxies)
    let added = 0

    for (const record of records) {
      const existing = seen.get(proxyKey(record))

      if (existing?.restricted && record.provider) {
        existing.provider = record.provider
      }
      if (seen.has(proxyKey(record)) || state.proxies.length === MAX_PROXIES) {
        continue
      }
      seen.set(proxyKey(record), record)
      state.proxies.push({ ...record, id: newProxyId() })
      added++
    }
    state.added = added
    state.skipped = records.length - added
  } else if (action.operation === 'remove') {
    const { ids } = action

    if (ids.includes('builtin')) {
      throw new Error('Cannot remove the managed proxy')
    }
    state.proxies = state.proxies.filter(({ id }) => !ids.includes(id))
    state.selectedProxyIds = state.selectedProxyIds.filter(
      (id) => !ids.includes(id),
    )
  } else {
    const available = new Set(['builtin', ...state.proxies.map(({ id }) => id)])
    let ids = state.selectedProxyIds

    if (action.operation === 'toggle') {
      if (!available.has(action.id)) {
        throw new Error('Invalid proxy selection')
      }
      ids = action.selected ? [...ids, action.id]
        : ids.filter((entry) => entry !== action.id)
    } else {
      ids = action.ids
    }
    if (ids.some((id) => !available.has(id))) {
      throw new Error('Invalid proxy selection')
    }
    state.selectedProxyIds = Array.from(new Set(ids))
  }
  let runtime = {}

  if (action.operation === 'remove') {
    const { proxyChecks, proxyFailures } = await browser.storage.local.get({
      proxyChecks: {}, proxyFailures: {},
    })

    for (const id of action.ids) {
      delete proxyChecks[id]
      delete proxyFailures[id]
    }
    runtime = { proxyChecks, proxyFailures }
  }
  await browser.storage.local.set({
    ...runtime,
    proxies: validateProxyList(state.proxies),
    selectedProxyIds: state.selectedProxyIds,
    useOwnProxy: state.selectedProxyIds.some((id) => id !== 'builtin'),
    customProxyProtocol: 'HTTPS',
    customProxyServerURI: '',
  })
  return state
}
