import { callBackground } from 'Background/background-rpc'
import browser from 'Background/browser-api'
import { hasDataConsent } from 'Background/data-consent'
import { getMessage } from 'Background/i18n'
import Ignore from 'Background/ignore'
import ProxyManager from 'Background/proxy'
import Registry from 'Background/registry'
import Settings from 'Background/settings'
import { extractHostnameFromUrl, isI2PUrl, isOnionUrl, isValidURL } from 'Background/utilities'

export const readPopup = async () => {
  const consent = await hasDataConsent()

  if (!consent) {
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
  const site = valid ? await callBackground('domainStatus', url) : null
  const domain = enabled ? await callBackground('domainStatus', hostname) : null
  const disseminator = enabled ? await
  Registry.retrieveDisseminator(hostname) : {}
  const controlled = !browser.isFirefox && await
  ProxyManager.controlledByOtherExtensions()
  const highlight = await callBackground('registryEmpty')
  let choice = site?.custom ? 'always' : 'auto'

  if (ignored) {
    choice = 'never'
  }
  let image = 'normal'

  if (domain?.blocked) {
    image = 'blocked'
  }
  if (disseminator.url) {
    image = disseminator.cooperationRefused ? 'normal' : 'ori'
    if (domain?.blocked && disseminator.cooperationRefused === false) {
      image = 'ori_blocked'
    }
  }
  let network = ''

  if (isOnionUrl(url)) {
    network = 'tor'
  } else if (isI2PUrl(url)) {
    network = 'i2p'
  }
  if (network) {
    image = network
  }
  if (!enabled) {
    image = 'disabled'
  }
  let fontSize: string | undefined = !valid && getMessage('popupNewTabMessage').length >= 25
    ? '15px' : undefined

  if (enabled) {
    if (hostname.length >= 22 && hostname.length < 25) {
      fontSize = '17px'
    } else if (hostname.length > 25 && hostname.length < 30) {
      fontSize = '15px'
    } else if (hostname.length >= 30) {
      fontSize = '13px'
    }
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
    image,
    network,
    fontSize,
  }
}
