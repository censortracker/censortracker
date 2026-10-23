import type { importAntizapret } from './antizapret'
import browser from './browser-api'
import type { getDataConsent } from './data-consent'
import type { getDiagnosticInfo } from './diagnostics'
import type { pendingNotices } from './extension-notices'
import type * as operations from './operations'
import type { readPopupState } from './popup-state'
import type ProxyManager from './proxy'
import type { getProxyCheckState, startProxyChecks } from './proxy-check'
import type { ImportOptions, importProxies, refreshSubscription, SubscriptionAction, updateSubscriptions } from './proxy-importer'
import type { describeProxyRoute } from './proxy-info'
import type { ProxyListAction, updateProxyList } from './proxy-list'
import type Registry from './registry'
import type { getRegistrySourceState, refreshRegistrySource } from './registry-source'
import type { addRelatedDomains, findRelatedDomains } from './related-domains'
import type { SynchronizeOptions } from './server'
import type Settings from './settings'
import type { changeSiteRule, SiteRuleChange } from './site-rules'
import { isRecord } from './value'

export type SiteChoice = 'auto' | 'always' | 'never'
type Result<T extends (...args: never[]) => unknown> = Awaited<ReturnType<T>>
type SourceState = Result<typeof getRegistrySourceState>

// This map is the shared contract for page calls and background handlers.
export interface Actions {
  dataConsent: [undefined, Result<typeof getDataConsent>]
  setDataConsent: [boolean, void]
  openDataConsent: [undefined, void]
  diagnosticInfo: [undefined, Result<typeof getDiagnosticInfo>]
  setLocalProxy: [boolean, void]
  syncLocalProxy: [{ startIfMissing?: boolean } | undefined,
    Result<typeof ProxyManager.syncLocalProxy>]
  findRelatedDomains: [{ tabId?: number; url?: string },
    Result<typeof findRelatedDomains>]
  addRelatedDomains: [string[], Result<typeof addRelatedDomains>]
  registryStatus: [undefined, Result<typeof Registry.getStatus>]
  registryEmpty: [undefined, boolean]
  setSiteChoice: [{ url: string; choice: SiteChoice }, void]
  registrySourceState: [undefined, SourceState]
  updateRegistrySource: [unknown, SourceState]
  refreshRegistrySource: [undefined, Result<typeof refreshRegistrySource>]
  proxyRouteInfo: [{ url?: string }, Result<typeof describeProxyRoute>]
  siteCountryRule: [SiteRuleChange, ReturnType<typeof changeSiteRule>]
  startProxyChecks: [{ ids?: string[] } | undefined,
    Result<typeof startProxyChecks>]
  setProxyRecovery: [boolean, void]
  stopProxyChecks: [undefined, void]
  proxyCheckState: [undefined, Result<typeof getProxyCheckState>]
  importProxies: [ImportOptions, Result<typeof importProxies>]
  importAntizapret: [undefined, Result<typeof importAntizapret>]
  subscriptions: [SubscriptionAction, Result<typeof updateSubscriptions>]
  refreshSubscription: [{ id: string }, Result<typeof refreshSubscription>]
  setProxyAll: [boolean, void]
  importSettings: [unknown, void]
  proxies: [ProxyListAction, Result<typeof updateProxyList>]
  synchronize: [SynchronizeOptions | undefined, void]
  ping: [boolean | undefined, Result<typeof ProxyManager.ping>]
  setProxy: [undefined, boolean]
  removeProxy: [undefined, void]
  popupState: [undefined, Result<typeof readPopupState>]
  notices: [undefined, Result<typeof pendingNotices>]
  dismissNotice: [string, void]
  consentPrompt: [undefined, boolean]
  setPreferences: [operations.Preferences, void]
  setExtensionEnabled: [boolean, void]
  setProxyEnabled: [boolean, void]
  incognitoAccess: [undefined, Result<typeof operations.incognitoAccess>]
  applyProxy: [boolean, void]
  proxyControl: [undefined, Result<typeof operations.proxyControl>]
  takeProxyControl: [undefined, void]
  saveDomains: [{ ignored: boolean; domains: string[] }, string[]]
  downloadDomains: [string, Result<typeof operations.downloadDomains>]
  setRegistryEnabled: [boolean, void]
  updateRegistry: [undefined, void]
  resetSettings: [undefined, void]
  restoreSettings: [unknown, void]
  exportSettings: [undefined, Result<typeof Settings.exportSettings>]
}

// Only this extension's background answers this message type.
const isReply = <T>(result: unknown): result is { value: T } =>
  isRecord(result) && !result.error

export const callBackground = async <K extends keyof Actions>(action: K,
  ...[args]: undefined extends Actions[K][0]
    ? [args?: Actions[K][0]] : [args: Actions[K][0]]
): Promise<Actions[K][1]> => {
  const result = await browser.runtime.sendMessage({
    type: 'ct-background', action, args,
  })

  if (!isReply<Actions[K][1]>(result)) {
    throw new Error(isRecord(result) && typeof result.error === 'string'
      ? result.error : 'Background request failed')
  }
  return result.value
}
