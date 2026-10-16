import type { SiteChoice } from './background-rpc'
import browser from './browser-api'
import { hasDataConsent } from './data-consent'
import Ignore from './ignore'
import ProxyManager from './proxy'
import Registry from './registry'
import Settings from './settings'
import { extractHostnameFromUrl, isI2PUrl, isOnionUrl, isValidURL } from './utilities'

export const readPopupState = async () => {
  if (!await hasDataConsent()) {
    return { consent: false as const }
  }
  const [{ url = '', id: tabId } = {}] = await browser.tabs.query({ active: true, lastFocusedWindow: true })
  const proxying = await ProxyManager.isEnabled()
  const enabled = await Settings.extensionEnabled()
  const hostname = extractHostnameFromUrl(url) || ''
  const valid = isValidURL(url)
  const { useLocalProxy, localProxyAlive, backendIsIntermittent } = await
  browser.storage.local.get([
    'useLocalProxy', 'localProxyAlive', 'backendIsIntermittent',
  ])
  const alive = await ProxyManager.alive()
  const connectionIssues = proxying && !alive && !useLocalProxy &&
    !(browser.isFirefox && !await browser.extension.isAllowedIncognitoAccess())
  const ignored = valid && await Ignore.contains(url)
  const site = valid ? await Registry.getDomainStatus(url) : null
  const domain = enabled ? await Registry.getDomainStatus(hostname) : null
  const disseminator = enabled ? await
  Registry.retrieveDisseminator(hostname) : {}
  const controlled = !browser.isFirefox && await
  ProxyManager.controlledByOtherExtensions()
  const highlight = await Registry.isEmpty()
  let choice: SiteChoice = site?.custom ? 'always' : 'auto'

  if (ignored) {
    choice = 'never'
  }
  let network: '' | 'tor' | 'i2p' = ''

  if (isOnionUrl(url)) {
    network = 'tor'
  } else if (isI2PUrl(url)) {
    network = 'i2p'
  }
  return {
    consent: true as const,
    url,
    tabId,
    hostname,
    valid,
    proxying,
    enabled,
    useLocalProxy,
    localProxyAlive,
    backendIsIntermittent,
    alive,
    connectionIssues,
    domain,
    disseminator,
    controlled,
    highlight,
    choice,
    network,
  }
}
