import { importAntizapret } from './antizapret'
import type { Actions, SiteChoice } from './background-rpc'
import browser from './browser-api'
import { getDataConsent } from './data-consent'
import { getDiagnosticInfo } from './diagnostics'
import { dismissNotice, pendingNotices } from './extension-notices'
import { openDataConsent, setDataConsent } from './handlers'
import { normalizeHostname } from './hostname'
import { initializeLanguage } from './i18n'
import Ignore from './ignore'
import * as operations from './operations'
import { readPopupState } from './popup-state'
import ProxyManager from './proxy'
import { getProxyCheckState, startProxyChecks, stopProxyChecks } from './proxy-check'
import { importProxies, refreshSubscription, updateSubscriptions } from './proxy-importer'
import { describeProxyRoute } from './proxy-info'
import { proxyListAction, updateProxyList } from './proxy-list'
import { proxyAllowed, withProxyLock } from './proxy-route'
import Registry from './registry'
import { getRegistrySourceState, refreshRegistrySource, updateRegistrySource } from './registry-source'
import { addRelatedDomains, findRelatedDomains } from './related-domains'
import { synchronizeInBackground } from './server'
import Settings from './settings'
import { changeSiteRule } from './site-rules'
import { errorMessage, isRecord, toRecord } from './value'

// Message arguments are untrusted. Each handler checks its own argument.
type Handlers = {
  [K in keyof Actions]: (args: unknown) =>
    Actions[K][1] | Promise<Actions[K][1]>
}

const flag = (value: unknown, message = 'Invalid option') => {
  if (typeof value !== 'boolean') {
    throw new TypeError(message)
  }
  return value
}
const isSiteChoice = (value: unknown): value is SiteChoice =>
  value === 'always' || value === 'never' || value === 'auto'
const synchronizeOptions = (value: unknown) => {
  const { syncRegistry, syncProxy, region } = toRecord(value)
  const { countryCode, countryName } = toRecord(region)
  const valid = typeof countryCode === 'string' &&
    typeof countryName === 'string'

  if (region !== undefined && !valid) {
    throw new TypeError('Invalid region')
  }
  return {
    ...typeof syncRegistry === 'boolean' ? { syncRegistry } : {},
    ...typeof syncProxy === 'boolean' ? { syncProxy } : {},
    ...valid ? { region: { countryCode, countryName } } : {},
  }
}

export const backgroundActions: Handlers = {
  dataConsent: getDataConsent,
  setDataConsent,
  openDataConsent,
  diagnosticInfo: getDiagnosticInfo,
  setLocalProxy: (enabled) =>
    ProxyManager.setLocalProxy(flag(enabled, 'Invalid local proxy mode')),
  syncLocalProxy: (options) => ProxyManager.syncLocalProxy({
    startIfMissing: toRecord(options).startIfMissing === true,
  }),
  findRelatedDomains,
  addRelatedDomains,
  registryStatus: () => Registry.getStatus(),
  registryEmpty: () => Registry.isEmpty(),
  setSiteChoice: (args) => withProxyLock(async () => {
    const { url, choice } = toRecord(args)

    if (!isSiteChoice(choice) ||
      typeof url !== 'string' || url.length > 8192 || !normalizeHostname(url)) {
      throw new TypeError('Invalid site choice')
    }
    if (choice === 'never') {
      await Ignore.add(url)
      await Registry.remove(url)
    } else {
      await Ignore.remove(url)
      if (choice === 'always') {
        await Registry.add(url)
      } else {
        await Registry.remove(url)
      }
    }
    if (!await ProxyManager.setProxyInBackground({ ping: false }) &&
      await proxyAllowed()) {
      throw new Error('Site choice saved, but routing could not be applied')
    }
  }),
  registrySourceState: getRegistrySourceState,
  updateRegistrySource,
  refreshRegistrySource: () => refreshRegistrySource(),
  proxyRouteInfo: (args) => {
    const { url } = toRecord(args)

    return describeProxyRoute({ url: typeof url === 'string' ? url : undefined })
  },
  siteCountryRule: (args) => withProxyLock(async () => {
    const { siteCountryRules } = await browser.storage.local.get({
      siteCountryRules: {},
    })
    const rules = changeSiteRule(siteCountryRules, args)

    await browser.storage.local.set({ siteCountryRules: rules })

    if (!await ProxyManager.setProxyInBackground({ ping: false }) &&
      await proxyAllowed()) {
      throw new Error('Site rule saved, but routing could not be applied')
    }
    return rules
  }),
  startProxyChecks: (args) => startProxyChecks({ ids: toRecord(args).ids }),
  setProxyRecovery: async (enabled) => {
    await browser.storage.local.set({
      proxyRecoveryEnabled: flag(enabled, 'Invalid proxy recovery option'),
    })
  },
  stopProxyChecks,
  proxyCheckState: getProxyCheckState,
  importProxies,
  importAntizapret,
  subscriptions: updateSubscriptions,
  refreshSubscription: (args) => {
    const { id } = toRecord(args)

    if (typeof id !== 'string') {
      throw new TypeError('Invalid subscription')
    }
    return refreshSubscription({ id })
  },
  setProxyAll: (enabled) => withProxyLock(async () => {
    await browser.storage.local.set({
      proxyAll: flag(enabled, 'Invalid proxy-all option'),
    })
    if (!await ProxyManager.setProxyInBackground() && await proxyAllowed()) {
      throw new Error('Proxy mode saved, but routing could not be applied')
    }
  }),
  importSettings: operations.importSettings,
  proxies: (args) => withProxyLock(async () => {
    const action = proxyListAction(args)
    const state = await updateProxyList(action)

    if (action.operation !== 'list') {
      await ProxyManager.setProxyInBackground()
    }
    return state
  }),
  synchronize: (options) =>
    synchronizeInBackground(synchronizeOptions(options)),
  ping: (force = false) =>
    ProxyManager.ping(flag(force, 'Invalid proxy ping option')),
  setProxy: () => ProxyManager.setProxy(),
  removeProxy: () => ProxyManager.removeProxy(),
  popupState: readPopupState,
  notices: pendingNotices,
  dismissNotice: (id) => {
    if (typeof id !== 'string') {
      throw new TypeError('Invalid notice')
    }
    return dismissNotice(id)
  },
  consentPrompt: operations.consentPrompt,
  setPreferences: operations.setPreferences,
  setExtensionEnabled: (enabled) =>
    operations.setExtensionEnabled(flag(enabled)),
  setProxyEnabled: (enabled) => operations.setProxyEnabled(flag(enabled)),
  incognitoAccess: operations.incognitoAccess,
  applyProxy: (enable) => operations.applyProxy(flag(enable)),
  proxyControl: operations.proxyControl,
  takeProxyControl: operations.takeProxyControl,
  saveDomains: operations.saveDomains,
  downloadDomains: operations.downloadDomains,
  setRegistryEnabled: (enabled) =>
    operations.setRegistryEnabled(flag(enabled)),
  updateRegistry: operations.updateRegistry,
  resetSettings: operations.resetSettings,
  restoreSettings: operations.restoreSettings,
  exportSettings: () => Settings.exportSettings(),
}

const isAction = (value: unknown): value is keyof Actions =>
  typeof value === 'string' &&
  Object.prototype.hasOwnProperty.call(backgroundActions, value)

export const registerBackground = () => {
  browser.runtime.onMessage.addListener((message: unknown, sender, respond) => {
    if (!isRecord(message) || message.type !== 'ct-background' ||
      sender.id !== browser.runtime.id) {
      return false
    }
    const { action, args } = message

    if (!isAction(action)) {
      respond({ error: 'Unknown background action' })
      return false
    }
    initializeLanguage().then(() => backgroundActions[action](args))
      .then((value) => respond({ value }),
        (error: unknown) => respond({ error: errorMessage(error) }))
    return true
  })
}
