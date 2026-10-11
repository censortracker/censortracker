import { callBackground } from 'Background/background-rpc'
import browser from 'Background/browser-api'
import { getMessage, getUILanguage } from 'Background/i18n'
import { useLayoutEffect, useRef } from 'preact/hooks'

import { useResource, useStorageChanges } from '../../hooks/async'
import styles from '../../styles/popup.module.scss'
import { InfoBlock } from './info-block'

export const ProxyInfo = ({ url, open, hidden, onToggle }: {
  url: string; open: boolean; hidden: boolean; onToggle: () => void
}) => {
  const { value: info, error, refresh, invalidate } = useResource(
    () => callBackground('proxyRouteInfo', { url }),
  )
  const timer = useRef<number | undefined>(undefined)
  const schedule = () => {
    invalidate()
    clearTimeout(timer.current)
    timer.current = window.setTimeout(refresh, 300)
  }

  useLayoutEffect(() => {
    browser.proxy.settings.onChange?.addListener(schedule)
    return () => {
      clearTimeout(timer.current)
      browser.proxy.settings.onChange?.removeListener(schedule)
    }
  }, [])
  useStorageChanges((changes) => {
    if (['enableExtension', 'useProxy', 'proxyAll', 'proxies',
      'selectedProxyIds', 'proxyServerURI', 'proxyChecks', 'proxyFailures',
      'siteCountryRules', 'ignoredHosts', 'domains', 'useRegistry',
      'customProxiedDomains', 'localProxyURI', 'currentRegionName',
      'currentRegionCode', 'registryRegionCode', 'activeProxyConfigName',
      'registrySource', 'externalRegistry', 'antizapret'].some((key) => changes[key])) {
      schedule()
    }
  })
  const lines: string[] = []
  const names = new Intl.DisplayNames([getUILanguage()], { type: 'region' })
  let summary = error ? getMessage('popupRoute_unavailable') : ''
  let exit = ''

  if (info && !error) {
    summary = info.proxy ? getMessage('popupRouteProxy', info.proxy.name)
      : getMessage(`popupRoute_${info.type}`)
    const builtin = info.proxy?.id === 'builtin' || info.proxy?.name === 'Censor Tracker'

    if (builtin && info.check?.exitCountry) {
      const code = info.check.exitCountry

      exit = `${getMessage('proxyExitCountry')}: ${names.of(code)} (${code})`
    }
    if (info.proxy && !builtin) {
      lines.push(`${info.proxy.protocol} ${info.proxy.host}:${info.proxy.port}`,
        getMessage('popupRouteFallbacks', String(info.fallbackCount)))
      if (info.check) {
        lines.push(getMessage('popupRouteCheckedAt',
          new Date(info.check.checkedAt).toLocaleString(getUILanguage())),
        getMessage(`proxyStatus_${info.check.status}`))
        if (info.check.exitIP) {
          const code = info.check.exitCountry
          const country = code ? `${names.of(code)} (${code})` : getMessage('proxyFilterUnknown')

          exit = getMessage('popupRouteExit', [info.check.exitIP, country])
        }
      } else {
        lines.push(getMessage('proxyStatus_unchecked'))
      }
    }
    if (info.domainCount !== undefined) {
      const region = info.regionCode ? names.of(info.regionCode) : info.region || getMessage('popupAutoMessage')

      lines.push(`${getMessage('popupYourRegion')}: ${region}`, `${getMessage('popupTotalBlocked')}: ${info.domainCount}`)
    }
    lines.push(getMessage('popupRouteHelp'))
  }
  return <InfoBlock id="proxying-info" title="popupProxyInfoTitle" icon="question"
    open={open} onToggle={onToggle} hidden={hidden} route
    details={<div id="proxyingDetailsText">{lines.map((line, index) => <code key={index}>{line}</code>)}</div>}>
    <div class={styles.proxy_info} id="proxyRouteSummary" role="status">{summary}</div>
    <div class={styles.proxy_info} id="proxyRouteExit">{exit}</div>
  </InfoBlock>
}
