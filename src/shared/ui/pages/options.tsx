import { callBackground } from 'Background/background-rpc'
import browser from 'Background/browser-api'
import { getMessage, initializeLanguage } from 'Background/i18n'

import button from '../components/button.module.scss'
import { ConsentStatus } from '../components/consent-status'
import { Card, Toggle } from '../components/form'
import { mainDocument, SettingsLayout } from '../components/layout'
import { RichMessage } from '../components/message'
import { NavigationLink } from '../components/navigation-link'
import { RegistryStatus } from '../components/registry-status'
import select from '../components/select.module.scss'
import { useAction, useResource } from '../hooks/async'
import { usePageError } from '../hooks/errors'
import { useKeySequence } from '../hooks/key-sequence'
import type { PageView } from '../routes'
import styles from '../styles/options.module.scss'
import { PrivateBrowsing } from './options/private-browsing'

const contacts = [
  ['https://censortracker.org/#faq', 'faqLink'],
  ['https://storage.googleapis.com/amnezia/censortracker#faq', 'faqMirrorLink'],
  ['https://t.me/censortracker_support_bot', 'supportBotLink'],
  ['https://t.me/censortracker_feedback', 'communityChatLink'],
  ['mailto:support@censortracker.org', 'supportEmailLink'],
] as const

export const OptionsPage = () => {
  useKeySequence()
  const { value, error: readError, refresh } = useResource(async () => ({
    language: await initializeLanguage(),
    ...await browser.storage.local.get({
      useProxy: true,
      updateAvailable: false,
      backendIsIntermittent: false,
      showNotifications: true,
    }),
  }))
  const { error, run } = useAction()

  usePageError(error || readError)

  return <SettingsLayout linkedImage>
    <ConsentStatus />
    <div class={styles['main-page__title']}>{getMessage('optionsTitle')}</div>
    <div id="updateAvailableAlert" class={styles.update_available}
      hidden={!value?.updateAvailable}>
      <div class={styles.disclaimer__title}>{getMessage('updateAvailableTitle')}</div>
      <div class={`${styles.disclaimer__text} ${styles['disclaimer-mb']}`}>
        {getMessage('updateAvailableDesc')}
      </div>
      <button type="button" id="updateExtensionButton"
        class={`${styles['update-btn']} ${button.plain}`} onClick={() => run(async () => {
          await callBackground('setPreferences', { updateAvailable: false })
          browser.runtime.reload()
        })}>{getMessage('updateAvailableButtonTitle')}</button>
    </div>
    <Card title="censorshipCircumventionBlockTitle">
      <div id="backendIsIntermittentAlert" class={styles.proxy__disclaimer}
        hidden={!value?.backendIsIntermittent}>
        <div class={styles.disclaimer__title}>{getMessage('backendIsIntermittentTitle')}</div>
        <RichMessage as="div" class={styles.disclaimer__text}
          message="backendIsIntermittentDesc" />
      </div>
      <NavigationLink groupId="proxyOptionsGroup" id="proxyOptionsButton"
        href="/proxy-options.html" title="proxySettings" description="optionsProxyDesc">
        <span class={styles['state-title']} id="proxyStatus" hidden={value === undefined}>
          {getMessage(value?.useProxy ? 'optionsProxyStatusTurnedOn' : 'optionsProxyStatusTurnedOff')}
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
          checked={value?.showNotifications ?? false}
          onChange={(checked) => run(() => callBackground('setPreferences', {
            showNotifications: checked,
          }), refresh)} />
        <div class={styles['main-page__about']}>{getMessage('showNotificationsDesc')}</div>
      </div>
    </Card>
    <Card title="extraBlockTitle">
      <div class={styles.checkbox__group}>
        <label for="uiLanguage" class={styles['main-page__turn']}>
          {getMessage('uiLanguageTitle')}
        </label>
        <select id="uiLanguage" class={`${select['select-toggle']} ${select['select-native']}`} value={value?.language || 'auto'}
          onChange={(event) => {
            const uiLanguage = event.currentTarget.value

            run(async () => {
              await callBackground('setPreferences', { uiLanguage })
              window.location.reload()
            })
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
        {contacts.map(([href, key]) => <a href={href} key={key}
          target={href.startsWith('mailto:') ? undefined : '_blank'}
          class={styles['options-link']}>
          <span class={`${styles['main-page__about']} ${styles['option-link-text']}`}>
            {getMessage(key)}
          </span><span class={styles['option-link-text']}>→</span>
        </a>)}
      </div>
    </Card>
    <div id="options-version" class={styles['options-version']}>
      <span id="version" class={styles.version}>{getMessage('optionsVersion', browser.runtime.getManifest().version)}</span>
    </div>
  </SettingsLayout>
}

export const page: PageView = {
  component: OptionsPage, bodyClass: mainDocument,
}
