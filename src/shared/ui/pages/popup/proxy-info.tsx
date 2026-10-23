import { callBackground } from 'Background/background-rpc'
import browser from 'Background/browser-api'
import { getMessage, getUILanguage } from 'Background/i18n'
import { useLayoutEffect, useRef } from 'preact/hooks'

import { countryLabel, regionName } from '../../country'
import {
  detach, useLatest, useResource, useStorageChanges,
} from '../../hooks/async'
import styles from '../../styles/popup.module.scss'
import { HideDetails, ShowDetails, statusIcon } from './info-block'
import componentStyles from './info-block.module.scss'

const routeKeys = ['enableExtension', 'useProxy', 'proxyAll', 'proxies',
  'selectedProxyIds', 'proxyServerURI', 'proxyChecks', 'proxyFailures',
  'siteCountryRules', 'ignoredHosts', 'domains', 'useRegistry',
  'customProxiedDomains', 'localProxyURI', 'currentRegionName',
  'currentRegionCode', 'registryRegionCode', 'activeProxyConfigName',
  'registrySource', 'externalRegistry', 'antizapret'] as const

export const ProxyInfo = ({ url, open, hidden, onToggle }: {
  url: string; open: boolean; hidden: boolean; onToggle: () => void
}) => {
  const { value: info, error, refresh, invalidate } = useResource(
    () => callBackground('proxyRouteInfo', { url }),
  )
  const timer = useRef<number | undefined>(undefined)
  const schedule = useLatest(() => {
    invalidate()
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => detach(refresh()), 300)
  })

  useLayoutEffect(() => {
    const changed = () => schedule.current()

    browser.proxy.settings.onChange?.addListener(changed)
    return () => {
      clearTimeout(timer.current)
      browser.proxy.settings.onChange?.removeListener(changed)
    }
  }, [schedule])
  useStorageChanges((changes) => {
    if (routeKeys.some((key) => changes[key])) {
      schedule.current()
    }
  })
  const lines: string[] = []
  let summary = error ? getMessage('popupRoute_unavailable') : ''
  let exit = ''

  if (info && !error) {
    summary = info.proxy ? getMessage('popupRouteProxy', info.proxy.name)
      : getMessage(`popupRoute_${info.type}`)
    const builtin = info.proxy?.id === 'builtin' || info.proxy?.name === 'Censor Tracker'

    if (builtin && info.check?.exitCountry) {
      const code = info.check.exitCountry

      exit = `${getMessage('proxyExitCountry')}: ${countryLabel(code)}`
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
          const country = code ? countryLabel(code) : getMessage('proxyFilterUnknown')

          exit = getMessage('popupRouteExit', [info.check.exitIP, country])
        }
      } else {
        lines.push(getMessage('proxyStatus_unchecked'))
      }
    }
    if (info.domainCount !== undefined) {
      const region = info.regionCode ? regionName(info.regionCode)
        : info.region || getMessage('popupAutoMessage')

      lines.push(`${getMessage('popupYourRegion')}: ${region}`, `${getMessage('popupTotalBlocked')}: ${info.domainCount}`)
    }
    lines.push(getMessage('popupRouteHelp'))
  }
  return <div id="proxying-info" hidden={hidden} class={componentStyles['main-page__block']}>
    <div class={componentStyles.block__title}>
      <span class={styles.unselectable}>{getMessage('popupProxyInfoTitle')}</span>
      <img class={`${componentStyles.icon__status} ${styles.unselectable}`}
        src={statusIcon('question')} width="24px" height="24px" alt="" />
    </div>
    <div class={`${styles.proxy_info} ${styles['proxy-route']}`} id="proxyRouteSummary" role="status">{summary}</div>
    <div class={`${styles.proxy_info} ${styles['proxy-route']}`} id="proxyRouteExit">{exit}</div>
    <ShowDetails open={open} onToggle={onToggle} label="popupProxyInfoShowDetails"
      class={styles.unselectable} />
    <div style={{ display: open ? 'block' : 'none' }}
      class={`${componentStyles.block__text} ${componentStyles['text-normal']} ${componentStyles['proxying-details']}`}>
      <div id="proxyingDetailsText" class={styles['proxy-route']}>{lines.map((line) => <code key={line}>{line}</code>)}</div>
      <div class={componentStyles.block__footer}>
        <HideDetails onToggle={onToggle} />
      </div>
    </div>
  </div>
}
