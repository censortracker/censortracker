import type { importAntizapret } from './antizapret'
import browser from './browser-api'
import type { Consent } from './data-consent'
import type { getDiagnosticInfo } from './diagnostics'
import type { ProxyCheck, ProxyCheckRun } from './proxy-check-data'
import type { ImportOptions, importProxies, refreshSubscription, SubscriptionAction, updateSubscriptions } from './proxy-importer'
import type { ProxyRouteInfo } from './proxy-info'
import type { ProxyListAction, ProxyListState } from './proxy-list'
import type { getRegistrySourceState } from './registry-source'
import type { SynchronizeOptions } from './server'
import type { SiteRuleChange, SiteRules } from './site-rules'

// This map is the shared contract for page calls and background handlers.
interface Actions {
  dataConsent: [undefined, Consent | null]
  setDataConsent: [boolean, void]
  openDataConsent: [undefined, void]
  diagnosticInfo: [undefined, Awaited<ReturnType<typeof getDiagnosticInfo>>]
  setLocalProxy: [boolean, void]
  syncLocalProxy: [{ startIfMissing?: boolean } | undefined, { alive: boolean }]
  findRelatedDomains: [{ tabId?: number; url?: string }, string[]]
  addRelatedDomains: [string[], number]
  domainStatus: [string,
    {
      blocked: boolean;
      custom: boolean;
      ignored: boolean
    }]
  registryStatus: [undefined, { state: string; skipped: number; error: string }]
  registryEmpty: [undefined, boolean]
  setSiteChoice: [{ url?: string; choice?: string }, void]
  registrySourceState: [undefined,
    Awaited<ReturnType<typeof getRegistrySourceState>>]
  updateRegistrySource: [unknown,
    Awaited<ReturnType<typeof getRegistrySourceState>>]
  refreshRegistrySource: [undefined,
Awaited<ReturnType<typeof getRegistrySourceState>> | undefined]
  proxyRouteInfo: [{ url?: string }, ProxyRouteInfo]
  siteCountryRule: [SiteRuleChange, SiteRules]
  startProxyChecks: [{ ids?: string[] } | undefined, ProxyCheckRun]
  setProxyRecovery: [boolean, void]
  stopProxyChecks: [undefined, void]
  proxyCheckState: [undefined,
    {
      checks: Record<string,
        ProxyCheck>;
      run: ProxyCheckRun
    }]
  importProxies: [ImportOptions, Awaited<ReturnType<typeof importProxies>>]
  importAntizapret: [undefined, Awaited<ReturnType<typeof importAntizapret>>]
  subscriptions: [SubscriptionAction,
    Awaited<ReturnType<typeof updateSubscriptions>>]
  refreshSubscription: [{ id: string },
    Awaited<ReturnType<typeof refreshSubscription>>]
  setProxyAll: [boolean, void]
  importSettings: [unknown, void]
  proxies: [ProxyListAction, ProxyListState]
  synchronize: [SynchronizeOptions | undefined, void]
  ping: [boolean | undefined, false | undefined]
  setProxy: [undefined, boolean]
  removeProxy: [undefined, void]
}
type Handlers = {
  [K in keyof Actions]: (args: Actions[K][0]) =>
    Actions[K][1] | Promise<Actions[K][1]>
}

let actions: Handlers | null = null

export const callBackground = async <K extends keyof Actions>(action: K,
  ...[args]: undefined extends Actions[K][0]
    ? [args?: Actions[K][0]] : [args: Actions[K][0]]
): Promise<Actions[K][1]> => {
  if (actions) {
    return actions[action](args as Actions[K][0])
  }
  const result = await browser.runtime.sendMessage({
    type: 'ct-background', action, args,
  })

  if (!result || result.error) {
    throw new Error(result?.error || 'Background request failed')
  }
  return result.value
}

export const registerBackground = (handlers: Handlers) => {
  actions = handlers
  browser.runtime.onMessage.addListener((message, sender, respond) => {
    if (message?.type !== 'ct-background' || sender.id !== browser.runtime.id) {
      return false
    }
    if (!Object.prototype.hasOwnProperty.call(actions, message.action)) {
      respond({ error: 'Unknown background action' })
      return false
    }
    const handler = handlers[message.action as keyof Actions] as
      (args: unknown) => unknown

    Promise.resolve().then(() => handler(message.args))
      .then((value) => respond({ value }),
        (error) => respond({ error: error.message }))
    return true
  })
}
