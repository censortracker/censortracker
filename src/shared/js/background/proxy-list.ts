import browser from './browser-api'
import { parseProxyAddress } from './proxy-address'
import type { ProxyRecord } from './proxy-record'
import {
  MAX_PROXIES, newProxyId, proxyKey, proxyStateFromSettings,
  validateProxy, validateProxyList,
} from './proxy-record'
import type { StorageState } from './storage'

export interface ProxyListState {
  proxies: ProxyRecord[]
  selectedProxyIds: string[]
  builtin: ProxyRecord
  added?: number
  skipped?: number
}
export interface ProxyListAction {
  operation?: 'list' | 'save' | 'append' | 'remove' | 'select' | 'toggle'
  proxy?: Partial<ProxyRecord>
  proxies?: ProxyRecord[]
  ids?: string[]
  id?: string
  selected?: boolean
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
  const builtin: ProxyRecord = { id: 'builtin', name: 'Censor Tracker', protocol: 'HTTPS' }

  try {
    Object.assign(builtin, parseProxyAddress(storage.proxyServerURI))
  } catch (error) {
    // The managed endpoint may be unavailable before its first successful sync.
  }
  return { ...proxyStateFromSettings(storage), builtin }
}

// The background caller holds the proxy lock across this write and PAC update.
export const updateProxyList = async ({
  operation, proxy, proxies, ids, id: proxyId, selected,
}: ProxyListAction = {}) => {
  const state = await readProxyState()

  if (operation === 'list') {
    return state
  }
  if (operation === 'save') {
    const record = validateProxy({ ...proxy, id: proxy?.id || newProxyId() })
    const index = state.proxies.findIndex(({ id }) => id === record.id)

    if (index < 0) {
      state.proxies.push(record)
    } else {
      if (state.proxies[index].provider) {
        record.provider = state.proxies[index].provider
        record.restricted = true
      }
      state.proxies[index] = record
    }
  } else if (operation === 'append') {
    const seen = new Map(
      state.proxies.map((record) => [proxyKey(record), record]),
    )
    let added = 0

    for (const record of validateProxyList(proxies)) {
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
    state.skipped = proxies!.length - added
  } else if (operation === 'remove') {
    if (!Array.isArray(ids) || ids.includes('builtin')) {
      throw new Error('Cannot remove the managed proxy')
    }
    state.proxies = state.proxies.filter(({ id }) => !ids!.includes(id))
    state.selectedProxyIds = state.selectedProxyIds.filter(
      (id) => !ids!.includes(id),
    )
  } else if (operation === 'select' || operation === 'toggle') {
    const available = new Set(['builtin', ...state.proxies.map(({ id }) => id)])

    if (operation === 'toggle') {
      if (!available.has(proxyId!) || typeof selected !== 'boolean') {
        throw new Error('Invalid proxy selection')
      }
      ids = selected ? [...state.selectedProxyIds, proxyId!]
        : state.selectedProxyIds.filter((entry) => entry !== proxyId)
    }
    if (!Array.isArray(ids) || ids.some((id) => !available.has(id))) {
      throw new Error('Invalid proxy selection')
    }
    state.selectedProxyIds = Array.from(new Set(ids))
  } else {
    throw new Error('Unknown proxy operation')
  }
  const runtime: Partial<Pick<StorageState, 'proxyChecks' | 'proxyFailures'>> = {}

  if (operation === 'remove') {
    Object.assign(runtime, await browser.storage.local.get({
      proxyChecks: {}, proxyFailures: {},
    }))
    for (const id of ids!) {
      delete runtime.proxyChecks![id]
      delete runtime.proxyFailures![id]
    }
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
