import browser from 'Background/browser-api'
import { getMessage, initializeLanguage } from 'Background/i18n'
import ProxyManager from 'Background/proxy'
import * as server from 'Background/server'
import { useEffect } from 'preact/hooks'

import { ConsentStatus } from '../components/consent-status'
import { Card, Toggle } from '../components/form'
import { SettingsLayout } from '../components/layout'
import { RichMessage } from '../components/message'
import { NavigationLink } from '../components/navigation-link'
import { PrivateBrowsing } from '../components/private-browsing'
import { RegistryStatus } from '../components/registry-status'
import { useResource } from '../hooks/async'
import { useKeySequence } from '../hooks/key-sequence'
import styles from '../styles/options.module.scss'

export const OptionsPage = () => {
  useEffect(() => {
    Object.assign(window, { server })
    return () => {
      Reflect.deleteProperty(window, 'server')
    }
  }, [])
  useKeySequence()
  const { value: language } = useResource(initializeLanguage)
  const { value: proxying, refresh } = useResource(() =>
    ProxyManager.isEnabled())
  const { value: flags } = useResource(() => browser.storage.local.get({
    updateAvailable: false, backendIsIntermittent: false,
  }))
  const { value: notifications, refresh: refreshNotifications } = useResource(
    () => browser.storage.local.get({ showNotifications: true }),
  )

  return <SettingsLayout linkedImage>
    <ConsentStatus />
    <div class={styles['main-page__title']}>{getMessage('optionsTitle')}</div>
    <div id="updateAvailableAlert" class={styles.update_available}
      hidden={!flags?.updateAvailable}>
      <div class={styles.disclaimer__title}>{getMessage('updateAvailableTitle')}</div>
      <div class={`${styles.disclaimer__text} ${styles['disclaimer-mb']}`}>
        {getMessage('updateAvailableDesc')}
      </div>
      <a id="updateExtensionButton" class={styles['update-btn']}
        onClick={async () => {
          await browser.storage.local.set({ updateAvailable: false })
          browser.runtime.reload()
        }}>{getMessage('updateAvailableButtonTitle')}</a>
    </div>
    <Card title="censorshipCircumventionBlockTitle">
      <div id="backendIsIntermittentAlert" class={styles.proxy__disclaimer}
        hidden={!flags?.backendIsIntermittent}>
        <div class={styles.disclaimer__title}>{getMessage('backendIsIntermittentTitle')}</div>
        <RichMessage as="div" class={styles.disclaimer__text}
          message="backendIsIntermittentDesc" />
      </div>
      <NavigationLink groupId="proxyOptionsGroup" id="proxyOptionsButton"
        href="/proxy-options.html" title="proxySettings" description="optionsProxyDesc">
        <span class={styles['state-title']} id="proxyStatus" hidden={proxying === undefined}>
          {getMessage(proxying ? 'optionsProxyStatusTurnedOn' : 'optionsProxyStatusTurnedOff')}
        </span>
      </NavigationLink>
      <PrivateBrowsing onSuccess={refresh} />
      <NavigationLink groupId="regionOptionsGroup" id="regionOptionsButton"
        href="/registry.html" title="optionsRegistryTitle" description="optionsRegistryDesc" />
      <RegistryStatus warning />
      <NavigationLink groupId="proxiedWebsitesEditor" id="proxiedWebsitesButton"
        href="/proxy-list.html" title="optionsProxiedWebsitesEditorTitle"
        description="optionsProxiedWebsitesEditorDesc" />
      <NavigationLink groupId="ignoreEditorGroup" id="ignoreEditorButton"
        href="/ignore-list.html" title="ignoredSitesTitle"
        description="optionsIgnoredWebsitesDesc" />
    </Card>
    <Card title="notificationsBlockTitle">
      <div class={styles.checkbox__group} id="showNotificationsGroup">
        <Toggle id="showNotificationsCheckbox" title="showNotificationsTitle"
          checked={notifications?.showNotifications ?? false}
          onChange={async (checked) => {
            await browser.storage.local.set({ showNotifications: checked })
            await refreshNotifications()
          }} />
        <div class={styles['main-page__about']}>{getMessage('showNotificationsDesc')}</div>
      </div>
    </Card>
    <Card title="extraBlockTitle">
      <div class={styles.checkbox__group}>
        <label for="uiLanguage" class={styles['main-page__turn']}>
          {getMessage('uiLanguageTitle')}
        </label>
        <select id="uiLanguage" class={styles['select-toggle']} value={language || 'auto'}
          onChange={async (event) => {
            await browser.storage.local.set({
              uiLanguage: event.currentTarget.value,
            })
            window.location.reload()
          }}>
          <option value="auto">{getMessage('uiLanguageAuto')}</option>
          <option value="en" lang="en">English</option>
          <option value="ru" lang="ru">Русский</option>
          <option value="uk" lang="uk">Українська</option>
        </select>
      </div>
      <NavigationLink groupId="advancedOptions" id="advancedOptionsButton"
        href="/advanced-options.html" title="advancedOptionsTitle"
        description="advancedOptionsDesc" grouped={false} />
      <div class={styles['options-links']} id="contacts">
        {[
          ['https://censortracker.org/#faq', 'faqLink'],
          ['https://storage.googleapis.com/amnezia/censortracker#faq', 'faqMirrorLink'],
          ['https://t.me/censortracker_support_bot', 'supportBotLink'],
          ['https://t.me/censortracker_feedback', 'communityChatLink'],
          ['mailto:support@censortracker.org', 'supportEmailLink'],
        ].map(([href, key]) => <a href={href} key={key}
          target={href.startsWith('mailto:') ? undefined : '_blank'}
          class={styles['options-link']}>
          <span class={`${styles['main-page__about']} ${styles['option-link-text']}`}>
            {getMessage(key)}
          </span><span class={styles['option-link-text']}>→</span>
        </a>)}
      </div>
    </Card>
    <div id="options-version">
      <span id="version">{getMessage('optionsVersion', browser.runtime.getManifest().version)}</span>
    </div>
  </SettingsLayout>
}
