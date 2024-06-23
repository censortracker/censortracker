import browser, { getBrowserInfo } from '../../../browser-api'
import ProxyManager from '../proxy'
import { defaultConfig } from './constants'

export const get = async (...keys) => {
  if (keys.length === 0) {
    return browser.storage.local.get(null)
  }
  const keyObject = {}

  for (const key of keys) {
    // if (!configKeys.includes(key)) {
    //   throw new Error(`${key} is not in the list of keys to be edited in local storage`)
    // }
    keyObject[key] = defaultConfig[key]
  }
  return browser.storage.local.get(keyObject)
}

export const set = async (state) => {
  return browser.storage.local.set(state)
}

export const remove = async (...keys) => {
  return browser.storage.local.remove(keys)
}

export const exportSettings = async () => {
  const settings = Object.assign({}, await get())

  settings.domains = []
  settings.disseminators = []

  return settings
}

export const importSettings = async (settings) => {
  await browser.storage.local.clear()
  set(settings)
}

export const getDebugInfo = async () => {
  const thisExtension = await browser.management.getSelf()
  const extensionsInfo = await browser.management.getAll()
  const { version: currentVersion } = browser.runtime.getManifest()

  const {
    localConfig = {},
    fallbackReason,
    fallbackProxyInUse = false,
    fallbackProxyError,
    proxyLastFetchTs,
  } = await get(
    'localConfig',
    'fallbackReason',
    'fallbackProxyInUse',
    'fallbackProxyError',
    'proxyLastFetchTs',
  )

  if (extensionsInfo.length > 0) {
    localConfig.conflictingExtensions = extensionsInfo
      .filter(({ name }) => name !== thisExtension.name)
      .filter(({ enabled, permissions = [] }) =>
        permissions.includes('proxy') && enabled)
      .map(({ name }) => name.split(' - ')[0])
  }

  localConfig.version = currentVersion

  if (fallbackProxyInUse) {
    localConfig.fallbackReason = fallbackReason
    localConfig.fallbackProxyError = fallbackProxyError
    localConfig.fallbackProxyInUse = fallbackProxyInUse
  }
  localConfig.browser = getBrowserInfo()
  localConfig.proxyLastFetchTs = proxyLastFetchTs
  localConfig.badProxies = await ProxyManager.getBadProxies()
  localConfig.currentProxyURI = await ProxyManager.getProxyingRules()
  localConfig.proxyControlled = await ProxyManager.controlledByThisExtension()

  return localConfig
}
