import {
  handleBeforeRequest,
  handleCustomProxiedDomainsChange,
  handleIgnoredHostsChange,
  handleInstalled,
  handleOnAlarm,
  handleOnUpdateAvailable,
  handleProxyError,
  handleStartup,
  handleStorageChanged,
  handleTabCreate,
  handleTabState,
  openDataConsent,
  pauseDataTransmission,
  scheduleLocalProxyCheck,
  setDataConsent,
} from 'Background/handlers'

import { importAntizapret } from './antizapret'
import { registerBackground } from './background-rpc'
import browser from './browser-api'
import { consentAccepted, getDataConsent, hasDataConsent } from './data-consent'
import { getDiagnosticInfo } from './diagnostics'
import { normalizeHostname } from './hostname'
import { initializeLanguage } from './i18n'
import Ignore from './ignore'
import ProxyManager from './proxy'
import { registerProxyAuth } from './proxy-auth'
import { getProxyCheckState, registerProxyChecks, startProxyChecks, stopProxyChecks } from './proxy-check'
import { importProxies, refreshSubscription, scheduleSubscriptions, updateSubscriptions } from './proxy-importer'
import { describeProxyRoute } from './proxy-info'
import { updateProxyList } from './proxy-list'
import { registerProxyRecovery } from './proxy-recovery'
import { proxyAllowed, withProxyLock } from './proxy-route'
import Registry from './registry'
import { getRegistrySourceState, refreshRegistrySource, registerRegistrySource, updateRegistrySource } from './registry-source'
import { addRelatedDomains, findRelatedDomains } from './related-domains'
import { synchronizeInBackground } from './server'
import { registerServiceMirrors } from './service-mirrors'
import Settings from './settings'
import { changeSiteRule } from './site-rules'

export const startBackground = () => {
  registerProxyAuth()
  initializeLanguage()
  registerRegistrySource()
  const consentReady = hasDataConsent()
    .then<boolean | void>((accepted) => accepted || pauseDataTransmission())

  consentReady.then(() => registerServiceMirrors())
    .catch(() => console.warn('Could not schedule service mirrors'))
  consentReady.then(() => registerProxyChecks()).catch(() => console.warn('Could not recover proxy checks'))
  consentReady.then(() => registerProxyRecovery()).catch(() => console.warn('Could not schedule proxy recovery'))

  const rescheduleSubscriptions = () => scheduleSubscriptions().catch(() => {
    console.warn('Could not schedule proxy subscriptions')
  })

  consentReady.then(rescheduleSubscriptions).catch(() => {})
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.dataConsent || changes.proxySubscriptions || changes.proxySubscriptionsEnabled || changes.enableExtension)) {
      rescheduleSubscriptions()
    }
  })

  consentReady.then(() => withProxyLock(() => {})).catch((error) => {
    console.error('[Service] Route recovery failed', error)
  })

  registerBackground({
    dataConsent: getDataConsent,
    setDataConsent,
    openDataConsent,
    diagnosticInfo: getDiagnosticInfo,
    setLocalProxy: (enabled) => withProxyLock(
      () => ProxyManager.setLocalProxyInBackground(enabled),
    ),
    syncLocalProxy: (options) => withProxyLock(
      () => ProxyManager.syncLocalProxyInBackground(options),
    ),
    findRelatedDomains,
    addRelatedDomains,
    domainStatus: (url) => Registry.getDomainStatus(url),
    registryStatus: () => Registry.getStatus(),
    registryEmpty: () => Registry.isEmpty(),
    setSiteChoice: ({ url, choice } = {}) => withProxyLock(async () => {
      if (!['always', 'never', 'auto'].includes(choice!) ||
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
    proxyRouteInfo: describeProxyRoute,
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
    startProxyChecks: ({ ids } = {}) => startProxyChecks({ ids }),
    setProxyRecovery: async (enabled) => {
      if (typeof enabled !== 'boolean') {
        throw new TypeError('Invalid proxy recovery option')
      }
      await browser.storage.local.set({ proxyRecoveryEnabled: enabled })
    },
    stopProxyChecks,
    proxyCheckState: getProxyCheckState,
    importProxies,
    importAntizapret,
    subscriptions: updateSubscriptions,
    refreshSubscription: ({ id }) => refreshSubscription({ id }),
    setProxyAll: (enabled) => withProxyLock(async () => {
      if (typeof enabled !== 'boolean') {
        throw new TypeError('Invalid proxy-all option')
      }
      await browser.storage.local.set({ proxyAll: enabled })
      if (!await ProxyManager.setProxyInBackground() && await proxyAllowed()) {
        throw new Error('Proxy mode saved, but routing could not be applied')
      }
    }),
    importSettings: (args) => withProxyLock(async () => {
      await Settings.importSettingsInBackground(args)
      await ProxyManager.syncLocalProxyInBackground()
      await ProxyManager.setProxyInBackground()
    }).then(async () => {
      const { source } = await getRegistrySourceState()

      if (source.enabled && await hasDataConsent()) {
        await refreshRegistrySource()
      }
    }),
    proxies: (args) => withProxyLock(async () => {
      const state = await updateProxyList(args)

      if (args.operation !== 'list') {
        await ProxyManager.setProxyInBackground()
      }
      return state
    }),
    synchronize: synchronizeInBackground,
    ping: (force) => withProxyLock(() => ProxyManager.pingInBackground(force)),
    setProxy: () => withProxyLock(() => ProxyManager.setProxyInBackground()),
    removeProxy: () => withProxyLock(
      () => ProxyManager.removeProxyInBackground(),
    ),
  })

  const registerListener = (
    event: { addListener(...args: never[]): void } | undefined,
    eventName: string,
    listener: (...args: never[]) => unknown,
    ...args: unknown[]) => {
    if (typeof event?.addListener !== 'function') {
      console.warn(`[Background] ${eventName} is unavailable.`)
      return
    }

    Reflect.apply(event.addListener, event, [listener, ...args])
  }

  // Handle alarms for async tasks
  registerListener(browser.alarms?.onAlarm, 'alarms.onAlarm', handleOnAlarm)
  // Handle extension lifecycle events
  registerListener(browser.runtime?.onStartup, 'runtime.onStartup', handleStartup)
  registerListener(browser.runtime?.onInstalled, 'runtime.onInstalled', handleInstalled)
  registerListener(
    browser.runtime?.onUpdateAvailable,
    'runtime.onUpdateAvailable',
    handleOnUpdateAvailable,
  )
  // Handle tab changes (e.g. new tab, tab closed)
  registerListener(browser.tabs?.onUpdated, 'tabs.onUpdated', handleTabState)
  registerListener(browser.tabs?.onCreated, 'tabs.onCreated', handleTabCreate)
  // Handle storage changes (e.g. settings)
  registerListener(browser.storage?.onChanged, 'storage.onChanged', handleStorageChanged)
  registerListener(browser.storage?.onChanged, 'storage.onChanged', handleIgnoredHostsChange)
  registerListener(
    browser.storage?.onChanged,
    'storage.onChanged',
    handleCustomProxiedDomainsChange,
  )

  if (browser.isFirefox) {
    // Firefox-specific handlers
    registerListener(browser.proxy?.onError, 'proxy.onError', handleProxyError)
    registerListener(
      browser.webRequest?.onBeforeRequest,
      'webRequest.onBeforeRequest',
      handleBeforeRequest,
      {
        urls: [
          'http://*/*',
          'https://*/*',
        ],
        types: [
          'main_frame',
        ],
      },
    )
    registerListener(
      browser.webRequest?.onErrorOccurred,
      'webRequest.onErrorOccurred',
      handleProxyError,
      {
        urls: [
          '<all_urls>',
        ],
      },
    )
  } else {
    // Chrome-specific handlers
    registerListener(
      browser.webNavigation?.onBeforeNavigate,
      'webNavigation.onBeforeNavigate',
      handleBeforeRequest,
      {
        urls: [
          'http://*/*',
          'https://*/*',
        ],
        types: [
          'main_frame',
        ],
      },
    )
    // «onProxyError» only reports errors in the PAC script itself.
    // Connection failures are reported by webNavigation.
    registerListener(browser.proxy?.onProxyError, 'proxy.onProxyError', handleProxyError)
    registerListener(
      browser.webNavigation?.onErrorOccurred,
      'webNavigation.onErrorOccurred',
      handleProxyError,
    )
  }

  const checkLocalProxy = () => scheduleLocalProxyCheck()
    .then(() => ProxyManager.syncLocalProxy()).catch(() => {
      console.warn('Local proxy check failed')
    })

  consentReady.then(checkLocalProxy).catch(() => {})
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.dataConsent || changes.useLocalProxy || changes.useProxy || changes.enableExtension)) {
      checkLocalProxy()
    }
  })

  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.dataConsent &&
      !consentAccepted(changes.dataConsent.newValue)) {
      pauseDataTransmission().catch(() => console.warn('Could not clear CT proxy settings'))
    }
  })
}
