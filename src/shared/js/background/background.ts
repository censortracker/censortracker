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
  pauseDataTransmission,
  scheduleLocalProxyCheck,
} from 'Background/handlers'

import { registerBackground } from './background-actions'
import browser from './browser-api'
import { consentAccepted, hasDataConsent } from './data-consent'
import { initializeLanguage } from './i18n'
import ProxyManager, { watchProxyCache } from './proxy'
import { registerProxyAuth } from './proxy-auth'
import { registerProxyChecks } from './proxy-check'
import { scheduleSubscriptions } from './proxy-importer'
import { registerProxyRecovery } from './proxy-recovery'
import { watchRoutes, withProxyLock } from './proxy-route'
import { watchRegistry } from './registry'
import { registerRegistrySource } from './registry-source'
import { registerServiceMirrors } from './service-mirrors'

export const startBackground = () => {
  watchRoutes()
  watchRegistry()
  watchProxyCache()
  registerProxyAuth()
  initializeLanguage().catch(() => {})
  registerRegistrySource()
  const consentReady = hasDataConsent()
    .then<boolean | void>((accepted) => accepted || pauseDataTransmission())

  consentReady.then(() => registerServiceMirrors())
    .catch(() => console.warn('Could not schedule service mirrors'))
  consentReady.then(() => registerProxyChecks()).catch(() => console.warn('Could not recover proxy checks'))
  consentReady.then(() => registerProxyRecovery()).catch(() => console.warn('Could not schedule proxy recovery'))

  const rescheduleSubscriptions = () => {
    scheduleSubscriptions().catch(() => {
      console.warn('Could not schedule proxy subscriptions')
    })
  }

  consentReady.then(rescheduleSubscriptions).catch(() => {})
  browser.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && (changes.dataConsent || changes.proxySubscriptions || changes.proxySubscriptionsEnabled || changes.enableExtension)) {
      rescheduleSubscriptions()
    }
  })

  consentReady.then(() => withProxyLock(() => {})).catch((error) => {
    console.error('[Service] Route recovery failed', error)
  })

  registerBackground()

  const registerListener = <A extends unknown[]>(
    event: { addListener(...args: A): void } | undefined,
    eventName: string,
    ...args: NoInfer<A>) => {
    if (typeof event?.addListener !== 'function') {
      console.warn(`[Background] ${eventName} is unavailable.`)
      return
    }
    event.addListener(...args)
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

  const beforeRequest = () => {
    handleBeforeRequest().catch(() => console.warn('Navigation check failed'))
  }

  if (browser.isFirefox) {
    // Firefox-specific handlers
    // This event reports only an Error, without the failed request.
    registerListener(browser.proxy?.onError, 'proxy.onError',
      () => handleProxyError({}))
    registerListener(
      browser.webRequest?.onBeforeRequest,
      'webRequest.onBeforeRequest',
      beforeRequest,
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
    // Chrome-specific handlers. This event has no URL or type filter.
    registerListener(
      browser.webNavigation?.onBeforeNavigate,
      'webNavigation.onBeforeNavigate',
      beforeRequest,
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

  const checkLocalProxy = () => {
    scheduleLocalProxyCheck()
      .then(() => ProxyManager.syncLocalProxy()).catch(() => {
        console.warn('Local proxy check failed')
      })
  }

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
