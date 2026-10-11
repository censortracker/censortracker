import browser from './browser-api'
import { hasDataConsent } from './data-consent'
import { MAX_IMPORT_BYTES, parseProxyImport } from './proxy-import'
import { updateProxyList } from './proxy-list'
import { newProxyId } from './proxy-record'
import { withProxyLock } from './proxy-route'
import type { Subscription } from './proxy-source'
import { validateSourceUrl, validateSubscriptions } from './proxy-source'
import { requestText } from './request'

export interface ImportOptions {
  text?: string
  url?: string
  protocol?: string
  pac?: boolean
}
export interface SubscriptionAction {
  operation?: 'list' | 'add' | 'remove' | 'enable'
  id?: string
  url?: string
  protocol?: string
  enabled?: boolean
}

export const SUBSCRIPTION_ALARM = 'proxy-subscriptions'
const downloads = new Map<string,
  {
    controller: AbortController;
    source: Subscription;
    automatic: boolean
  }>()
const sourceState = () => browser.storage.local.get({
  proxySubscriptions: [],
  proxySubscriptionsEnabled: false,
  proxySubscriptionCursor: 0,
  enableExtension: false,
})

const append = (text: string,
  options: {
    protocol?: string;
    pac?: boolean
  }) => {
  const result = parseProxyImport(text, options)

  return withProxyLock(async () => {
    const state = await updateProxyList({
      operation: 'append', proxies: result.proxies,
    })

    return {
      added: state.added,
      skipped: state.skipped! + result.skipped,
      truncated: result.truncated,
      fromPac: result.fromPac,
    }
  })
}

export const importProxies = async ({
  text,
  url,
  protocol,
  pac,
}: ImportOptions = {
}) => {
  if (url !== undefined) {
    pac = pac || new URL(validateSourceUrl(url)).pathname.toLowerCase().endsWith('.pac')
    text = await requestText(validateSourceUrl(url), {
      timeout: 60000, maxBytes: MAX_IMPORT_BYTES, redirect: 'error',
    })
  }
  return append(text!, { protocol, pac })
}

export const updateSubscriptions = (args: SubscriptionAction = {
}) => withProxyLock(async () => {
  const state = await sourceState()

  if (args.operation === 'add') {
    state.proxySubscriptions.push({
      id: newProxyId(), url: args.url!, protocol: args.protocol!,
    })
  } else if (args.operation === 'remove') {
    state.proxySubscriptions = state.proxySubscriptions.filter(
      ({ id }) => id !== args.id,
    )
  } else if (args.operation === 'enable') {
    if (typeof args.enabled !== 'boolean') {
      throw new TypeError('Invalid subscription option')
    }
    state.proxySubscriptionsEnabled = args.enabled
  } else if (args.operation === 'list') {
    return state
  } else {
    throw new Error('Invalid subscription operation')
  }
  await browser.storage.local.set({
    proxySubscriptions: validateSubscriptions(state.proxySubscriptions),
    proxySubscriptionsEnabled: state.proxySubscriptionsEnabled,
  })
  return state
})

export const refreshSubscription = async ({
  id,
  automatic = false,
}: {
  id: string;
  automatic?: boolean
}) => {
  const state = await sourceState()
  const source = state.proxySubscriptions.find((entry) => entry.id === id)

  if (downloads.has(id)) {
    throw new Error('Subscription download already running')
  }
  if (!source || (automatic &&
    (!state.proxySubscriptionsEnabled || !state.enableExtension))) {
    return undefined
  }
  const controller = new AbortController()

  downloads.set(id, { controller, source, automatic })
  try {
    const text = await requestText(validateSourceUrl(source.url), {
      timeout: 60000,
      maxBytes: MAX_IMPORT_BYTES,
      redirect: 'error',
      signal: controller.signal,
    })
    const result = parseProxyImport(text, {
      protocol: source.protocol,
      pac: new URL(source.url).pathname.toLowerCase().endsWith('.pac'),
    })

    return await withProxyLock(async () => {
      const current = await sourceState()

      if (controller.signal.aborted ||
        !current.proxySubscriptions.some((entry) => entry.id === id &&
          entry.url === source.url && entry.protocol === source.protocol) ||
        (automatic &&
          (!current.proxySubscriptionsEnabled || !current.enableExtension))) {
        return undefined
      }
      const appended = await updateProxyList({
        operation: 'append', proxies: result.proxies,
      })

      return {
        added: appended.added,
        skipped: appended.skipped! + result.skipped,
        truncated: result.truncated,
        fromPac: result.fromPac,
      }
    })
  } finally {
    downloads.delete(id)
  }
}

export const scheduleSubscriptions = () => withProxyLock(async () => {
  const state = await sourceState()

  for (const [id, { controller, source, automatic }] of downloads) {
    if (!await hasDataConsent() || (automatic &&
      (!state.proxySubscriptionsEnabled || !state.enableExtension)) ||
      !state.proxySubscriptions.some((entry) => entry.id === id &&
        entry.url === source.url && entry.protocol === source.protocol)) {
      controller.abort()
    }
  }
  const count = state.proxySubscriptions.length
  const alarm = await browser.alarms.get(SUBSCRIPTION_ALARM)

  if (!await hasDataConsent() || !state.proxySubscriptionsEnabled ||
    !state.enableExtension || !count) {
    await browser.alarms.clear(SUBSCRIPTION_ALARM)
  } else if (alarm?.periodInMinutes !== 60) {
    browser.alarms.create(SUBSCRIPTION_ALARM, { periodInMinutes: 60 })
  }
})

export const refreshNextSubscription = async () => {
  const source = await withProxyLock(async () => {
    const state = await sourceState()

    if (!state.proxySubscriptionsEnabled || !state.enableExtension ||
      state.proxySubscriptions.length === 0) {
      return undefined
    }
    const index = (Number(state.proxySubscriptionCursor) || 0) %
      state.proxySubscriptions.length

    await browser.storage.local.set({ proxySubscriptionCursor: index + 1 })
    return state.proxySubscriptions[index]
  })

  if (source) {
    await refreshSubscription({ id: source.id, automatic: true })
  }
}
