import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'
import ProxyManager from 'Background/proxy'
import { useEffect } from 'preact/hooks'

import { Conflicts } from '../components/conflicts'
import { Toggle } from '../components/form'
import { SettingsHeader, SettingsLayout } from '../components/layout'
import { useResource, useVisiblePolling } from '../hooks/async'
import { usePageError } from '../hooks/errors'
import { useKeySequence } from '../hooks/key-sequence'
import styles from '../styles/options.module.scss'
import { ProxyRecovery } from './proxy/checks'
import { ProxyList } from './proxy/list'

export const ProxyOptionsPage = () => {
  useKeySequence()
  const { value, error, refresh } = useResource(() =>
    browser.storage.local.get({
      useLocalProxy: false,
      useProxy: true,
      localProxyAlive: false,
      proxyIsAlive: true,
    }), ['useLocalProxy', 'useProxy', 'localProxyAlive', 'proxyIsAlive'])
  const { value: controlled } = useResource(() =>
    ProxyManager.controlledByOtherExtensions())

  useEffect(() => {
    ProxyManager.syncLocalProxy().then(refresh)
    document.addEventListener('visibilitychange', refresh)
    return () => document.removeEventListener('visibilitychange', refresh)
  }, [])
  useVisiblePolling(async () => {
    await ProxyManager.syncLocalProxy()
    await refresh()
  }, 3000)
  const toggle = async (checked: boolean) => {
    if (checked) {
      await ProxyManager.enableProxy()
      await ProxyManager.syncLocalProxy({ startIfMissing: true })
    } else {
      await ProxyManager.disableProxy()
    }
    await refresh()
  }
  const local = async (checked: boolean) => {
    await ProxyManager.setLocalProxy(checked)
    await refresh()
  }

  usePageError(error)

  return <SettingsLayout linkedImage>
    <SettingsHeader title="proxySettings" />
    <div id="proxyIsDown" class={styles.proxy__disclaimer}
      hidden={!value?.useProxy || value.useLocalProxy || value.proxyIsAlive}>
      <div class={styles.disclaimer__title}>{getMessage('proxyOptionsStatusTitle')}</div>
      <div class={styles.disclaimer__text}>{getMessage('proxyOptionsStatusDesc')}</div>
    </div>
    <div class={styles.checkbox__group}>
      <Toggle id="useProxyCheckbox" title="useProxy" checked={value?.useProxy || false}
        onChange={toggle} disabled={controlled} />
      <div class={styles['main-page__about']}>
        <div class={styles.use_proxy__text}>{getMessage('optionsProxyDesc')}</div>
      </div>
      <ProxyRecovery />
      <div id="proxyCustomOptions" hidden={!value?.useProxy}>
        <div id="proxyCustomOptionsRadioGroup" class={styles['radio-buttons-group']}>
          <div class={styles['radio-button']}>
            <input id="useDefaultProxy" class={styles['radio-button-input']} type="radio"
              name="proxy-radio" value="default" checked={!value?.useLocalProxy}
              onChange={() => local(false)} />
            <label class={styles['radio-button-label']} for="useDefaultProxy">
              {getMessage('useSelectedProxies')}
            </label>
          </div>
          <ProxyList hidden={value?.useLocalProxy || false} />
          <div class={styles['radio-button']}>
            <input id="useLocalProxy" class={styles['radio-button-input']} type="radio"
              name="proxy-radio" value="local" checked={value?.useLocalProxy || false}
              onChange={() => local(true)} />
            <label class={styles['radio-button-label']} for="useLocalProxy">
              {getMessage('useLocalProxy')}
            </label>
          </div>
          <p id="localProxyStatus" role="status">
            {value?.useProxy && value.useLocalProxy && value.localProxyAlive
              ? getMessage('successLocalProxySet') : ''}
          </p>
          <div class={styles['block_custom-local-proxy']} id="localProxyOptions"
            hidden={!value?.useProxy || !value.useLocalProxy ||
              value.localProxyAlive}>
            <div class={styles['censortracker-not-found__wrapper']} id="localProxyClientNotFound">
              <div>{getMessage('localProxyNotFoundDesc')}</div>
            </div>
            <div class={styles['local-proxy-links-container']} id="localProxyLinksContainer">
              {[
                ['moreAboutAmneziaPremiumLink', 'moreAboutAmneziaPremium', 'moreAboutLocalProxy'],
                ['whereToFindAddressLink', 'whereToFindAddressLink', 'whereToFindAddressAndPort'],
              ].map(([id, href, title]) => <a href={getMessage(href)}
                key={id} id={id}
                class={styles['local-proxy-link']} target="_blank" rel="noopener noreferrer">
                {getMessage(title)}
              </a>)}
            </div>
          </div>
        </div>
      </div>
      <Conflicts />
    </div>
  </SettingsLayout>
}
