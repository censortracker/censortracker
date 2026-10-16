import { callBackground } from 'Background/background-rpc'
import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'
import { useCallback, useEffect } from 'preact/hooks'

import button from '../components/button.module.scss'
import { Conflicts } from '../components/conflicts'
import { Toggle } from '../components/form'
import { settingsDocument, SettingsHeader, SettingsLayout } from '../components/layout'
import notice from '../components/notice.module.scss'
import radio from '../components/radio.module.scss'
import {
  detach, useAction, useResource, useVisiblePolling,
} from '../hooks/async'
import { usePageError } from '../hooks/errors'
import { useKeySequence } from '../hooks/key-sequence'
import type { PageView } from '../routes'
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
  const { value: control, error: controlError } = useResource(() =>
    callBackground('proxyControl'))
  const { error: actionError, run } = useAction()
  const sync = useCallback(async () => {
    await callBackground('syncLocalProxy')
    await refresh()
  }, [refresh])

  useEffect(() => detach(sync()), [sync])
  useVisiblePolling(sync, 3000)
  const toggle = (checked: boolean) =>
    run(() => callBackground('setProxyEnabled', checked), refresh)
  // A later route choice replaces a pending one, so it must not wait.
  const local = (checked: boolean) =>
    detach(callBackground('setLocalProxy', checked).finally(refresh))

  usePageError(error || controlError || actionError)

  return <SettingsLayout linkedImage>
    <SettingsHeader title="proxySettings" />
    <div id="proxyIsDown" class={styles.proxy__disclaimer}
      hidden={!value?.useProxy || value.useLocalProxy || value.proxyIsAlive}>
      <div class={styles.disclaimer__title}>{getMessage('proxyOptionsStatusTitle')}</div>
      <div class={styles.disclaimer__text}>{getMessage('proxyOptionsStatusDesc')}</div>
    </div>
    <div class={styles.checkbox__group}>
      <Toggle id="useProxyCheckbox" title="useProxy" checked={value?.useProxy || false}
        onChange={toggle} disabled={control?.controlled} />
      <div class={styles['main-page__about']}>
        <div class={styles.use_proxy__text}>{getMessage('optionsProxyDesc')}</div>
      </div>
      <ProxyRecovery />
      <div id="proxyCustomOptions" hidden={!value?.useProxy}>
        <div id="proxyCustomOptionsRadioGroup" class={radio['radio-buttons-group']}>
          <div class={radio['radio-button']}>
            <input id="useDefaultProxy" type="radio"
              name="proxy-radio" value="default" checked={!value?.useLocalProxy}
              onChange={() => local(false)} />
            <label for="useDefaultProxy">
              {getMessage('useSelectedProxies')}
            </label>
          </div>
          <ProxyList hidden={value?.useLocalProxy || false} />
          <div class={radio['radio-button']}>
            <input id="useLocalProxy" type="radio"
              name="proxy-radio" value="local" checked={value?.useLocalProxy || false}
              onChange={() => local(true)} />
            <label for="useLocalProxy">
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
              {([
                ['moreAboutAmneziaPremiumLink', 'moreAboutAmneziaPremium', 'moreAboutLocalProxy'],
                ['whereToFindAddressLink', 'whereToFindAddressLink', 'whereToFindAddressAndPort'],
              ] as const).map(([id, href, title]) => <a href={getMessage(href)}
                key={id} id={id}
                target="_blank" rel="noopener noreferrer">
                {getMessage(title)}
              </a>)}
            </div>
          </div>
        </div>
      </div>
      <Conflicts classes={{
        box: notice['main-page__extension'],
        title: notice.extension__title,
        text: styles.extension__text,
        button: `${notice['default-btn']} ${button.plain}`,
      }} />
    </div>
  </SettingsLayout>
}

export const page: PageView = {
  component: ProxyOptionsPage, bodyClass: settingsDocument,
}
