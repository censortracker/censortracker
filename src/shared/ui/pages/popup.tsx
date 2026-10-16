import type { SiteChoice } from 'Background/background-rpc'
import { callBackground } from 'Background/background-rpc'
import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'
import { useState } from 'preact/hooks'

import button from '../components/button.module.scss'
import { RichMessage } from '../components/message'
import { Notices } from '../components/notices'
import { PopupLayout } from '../components/popup-layout'
import { PrivateBrowsingStatus } from '../components/private-browsing-status'
import { useAction, useResource, useStorageChanges } from '../hooks/async'
import { usePageError } from '../hooks/errors'
import { useKeySequence } from '../hooks/key-sequence'
import { usePrivateBrowsing } from '../hooks/private-browsing'
import { navigate } from '../navigation'
import type { PageView } from '../routes'
import styles from '../styles/popup.module.scss'
import { PopupConsentStatus } from './popup/consent-status'
import { InfoBlock } from './popup/info-block'
import { ProxyInfo } from './popup/proxy-info'
import { RelatedDomains } from './popup/related-domains'
import { readPopup } from './popup/state'

const plain = `${button.plain} ${button['plain-block']}`
const siteChoices = [
  { id: 'siteActionAuto', choice: 'auto', label: 'Auto' },
  { id: 'siteActionProxy', choice: 'always', label: 'Always' },
  { id: 'siteActionIgnore', choice: 'never', label: 'Never' },
] as const satisfies { id: string; choice: SiteChoice; label: string }[]

const reloadKeys = ['useLocalProxy', 'localProxyAlive', 'useProxy', 'dataConsent'] as const

export const PopupPage = () => {
  useKeySequence()
  const { value, error: readError } = useResource(readPopup)
  const { allowed, failure, status } = usePrivateBrowsing()
  const { error, run } = useAction()
  const [actions, setActions] = useState(false)
  const [details, setDetails] = useState('')
  const [chosen, setChosen] = useState<SiteChoice>()
  const state = value?.consent ? value : undefined
  const choice = chosen ?? state?.choice ?? 'auto'

  usePageError(error || readError)
  useStorageChanges((changes) => {
    if (reloadKeys.some((key) =>
      changes[key] && changes[key].newValue !== changes[key].oldValue)) {
      window.location.reload()
    }
  })
  const enable = () => run(async () => {
    if (!(await callBackground('dataConsent'))?.accepted) {
      await callBackground('openDataConsent')
      return
    }
    await callBackground('setExtensionEnabled', true)
    window.location.reload()
  })
  const disable = () => run(async () => {
    await callBackground('setExtensionEnabled', false)
    window.location.reload()
  })
  const toggleDetails = (id: string) => setDetails(details === id ? '' : id)
  const warning = Boolean(state?.disseminator.url &&
    !state.disseminator.cooperationRefused)
  let disseminatorDescription = 'notDisseminatorDesc'

  if (state?.disseminator.url) {
    disseminatorDescription = state.disseminator.cooperationRefused
      ? 'disseminatorCoopRefused' : 'disseminatorDesc'
  }
  const hideInfo = !state?.enabled || actions || Boolean(state.network)
  const choiceKey = siteChoices.find((item) => item.choice === choice)?.label
  const image = value?.consent === false ? 'images/popup/disabled.png'
    : `images/icons/512x512/${state?.image || 'normal'}.png`
  let restrictionTitle = 'notBlockedTitle'
  let restrictionDescription = 'notBlockedDesc'

  if (state?.domain?.blocked || state?.domain?.custom) {
    restrictionTitle = state.domain.blocked ? 'blockedTitle' : 'customProxiedTitle'
    restrictionDescription = state.domain.blocked ? 'blockedDesc' : 'customProxiedDesc'
  }
  const footerLinks = [
    {
      id: 'backendIsIntermittentPopupMessage',
      message: 'backendIsIntermittentPopupMessage',
      show: state?.backendIsIntermittent,
      click: () => browser.runtime.openOptionsPage(),
    },
    {
      id: 'proxyConnectionIssuesButton',
      message: 'proxyConnectionIssuesMessage',
      show: state?.connectionIssues,
      click: () => browser.tabs.create({ url: 'https://t.me/censortracker_feedback' }),
    },
    {
      id: 'controlledByOtherExtensionsButton',
      message: 'controlledByOtherExtensionsMessage',
      show: state?.controlled,
      click: () => navigate('/controlled.html'),
    },
  ]
  const footer = <>
    {footerLinks.map(({ id, message, show, click }) => <button type="button"
      class={`${styles['footer-btn']} ${plain}`} id={id} key={id} hidden={!show}
      onClick={() => run(async () => {
        await click()
      })}>
      <span>{getMessage(message)}</span>
    </button>)}
    <button type="button" id="privateBrowsingPermissionsRequiredButton"
      class={`${styles['footer-btn']} ${plain}`}
      hidden={allowed !== false} onClick={() => navigate('/incognito-required-popup.html')}>
      <span>{getMessage('privateBrowsingPermissionsRequiredMessage')}</span>
    </button>
    {browser.isFirefox &&
      <PrivateBrowsingStatus failure={failure} status={status} />}
    <div class={`${styles.footer} ${styles.unselectable}`} id="footerExtensionIsOn" hidden={!state?.enabled}>
      <div class={styles['censor-tracker']}>
        <div class={styles['censor-tracker__column']}>
          <div class={styles['censor-tracker__title']}>
            <b>Censor Tracker</b> <span class={styles['censor-tracker__turn']}>{getMessage('extensionEnabledTitle')}</span>
          </div>
          <div id="popupLocalProxyName" class={styles['censor-tracker__status']} hidden={!state?.useLocalProxy}>
            {getMessage(state?.useLocalProxy ? 'useLocalProxy' : 'popupProxyStatusOk')}
          </div>
          <div id="popupProxyStatusOk" class={styles['censor-tracker__status']}
            hidden={!state?.proxying || !(state.useLocalProxy
              ? state.localProxyAlive : state.alive)}>
            {getMessage('popupProxyStatusOk')}
          </div>
          <div id="popupProxyStatusError" class={`${styles['censor-tracker__status']} ${styles['status-error']}`}
            hidden={!state?.proxying || Boolean(state.useLocalProxy
              ? state.localProxyAlive : state.alive)}>
            {getMessage('popupProxyStatusError')}
          </div>
          <div id="popupProxyDisabled" class={styles['censor-tracker__status']}
            hidden={!state || state.proxying || Boolean(state.useLocalProxy)}>{getMessage('popupProxyDisabled')}</div>
        </div>
        <div class={styles['censor-tracker__column']}>
          <button type="button" class={`${styles['censor-tracker__btn']} ${plain}`} id="disableExtension"
            aria-label={getMessage('disableExtension')} onClick={disable}>
            <img class={styles['image__turn-tracker']} src="images/icons/512x512/btn_stop.svg" width="11px" height="16px" alt="" />
          </button>
        </div>
      </div>
    </div>
  </>

  return <PopupLayout footer={footer} image={<div class={styles['main-page__image']} id="statusImageDiv">
    <img id="statusImage" src={image} width="75px" height="auto" alt="Status" />
    <span id="highlightOptionsIcon" class={styles['red-dot']} hidden={!state?.highlight} />
    <a id="openOptionsPage" class={styles.icon__settings} href="/options.html" target="_blank"
      aria-label={getMessage('optionsPageTitle')} onClick={(event) => {
        event.preventDefault()
        run(() => browser.runtime.openOptionsPage())
      }} />
  </div>}>
    <Notices classes={{
      title: styles.block__title, button: styles['default-btn'],
    }} />
    <PopupConsentStatus />
    <div class={`${styles['main-page__title']} ${styles['title-domain']}`} hidden={value?.consent === false}>
      <div class={`${styles['current-domain']} ${styles['title-normal']} ${styles.unselectable} ${warning ? styles['title-ori'] : ''}`}
        id="currentDomainHeader" style={{ fontSize: state?.fontSize }}>
        {state && (state.valid ? state.hostname : getMessage('popupNewTabMessage'))}
      </div>
      <button type="button" id="toggleSiteActions" aria-expanded={actions}
        aria-label={getMessage('siteActionTitle')}
        class={`${styles.icon__site_settings} ${actions ? styles['icon-hide'] : styles['icon-show']} ${button.plain}`}
        hidden={!state?.valid || !state.enabled || Boolean(state.network)}
        onClick={() => setActions(!actions)} />
    </div>
    <div class={`${styles['main-page__block']} ${styles['main-page-setting']} ${styles.unselectable}`} id="siteActions" hidden={!actions}>
      <div class={styles.block__title}>{getMessage('siteActionTitle')}</div>
      <div class={styles['site-actions-group']}>
        {siteChoices.map(({ id, choice: mode, label }) => <div class={styles['site-actions-group-item']} key={id}>
          <input id={id} type="radio" name="site-action-radio" value={mode} checked={choice === mode}
            onChange={() => run(async () => {
              await callBackground('setSiteChoice', { url: state?.url ?? '', choice: mode })
              setChosen(mode)
            })} />
          <label for={id}>{getMessage(`siteActionItemLabel${label}`)}</label>
        </div>)}
      </div>
      <div class={styles.proxy_info} id="siteActionDescription">{getMessage(`siteAction${choiceKey}Desc`)}</div>
      {state?.valid && <RelatedDomains tabId={state.tabId} url={state.url} />}
    </div>
    {(['tor', 'i2p'] as const).map((network) => <div class={styles['network-description']} id={`${network}Network`}
      key={network} hidden={!state?.enabled || state.network !== network}>
      <RichMessage as="div" class={styles.network__title} message={`${network}NetworkTitle`} />
      <div>{getMessage('overlayNetworkDesc')}</div>
    </div>)}
    <InfoBlock id="ori" title={warning ? 'disseminatorTitle' : 'notDisseminatorTitle'}
      icon={warning ? 'danger' : 'ok'} warning={warning} hidden={hideInfo}
      open={details === 'ori'} onToggle={() => toggleDetails('ori')}
      description={disseminatorDescription} link="https://blockedin.org/ru/disseminators/" />
    <InfoBlock id="restrictions" title={restrictionTitle}
      icon={state?.domain?.blocked || state?.domain?.custom ? 'info' : 'ok'} hidden={hideInfo}
      open={details === 'restrictions'} onToggle={() => toggleDetails('restrictions')}
      description={restrictionDescription} link="https://blockedin.org/ru/" />
    {state?.enabled && state.hostname && <ProxyInfo key={state.url}
      url={state.url}
      hidden={hideInfo}
      open={details === 'proxy'} onToggle={() => toggleDetails('proxy')} />}
    <div class={`${styles['main-page__info']} ${styles.unselectable}`} id="extensionIsOff" hidden={!state || state.enabled}>
      <div class={`${styles['main-page__title']} ${styles['title-disabled']}`}>{getMessage('extensionDisabledTitle')}</div>
      <div class={styles['main-page__block']}>
        <div class={`${styles.block__title} ${styles['text-about']} ${styles['block-disabled']}`}>
          <span>{getMessage('turnOnExtensionToCheckWebsite')}</span>
        </div>
        <button type="button" class={`${styles['censor-tracker__btn']} ${styles['btn-on']} ${plain}`}
          id="enableExtension" aria-label={getMessage('enableExtension')} onClick={enable}>
          <img class={`${styles['image__turn-tracker']} ${styles['image__turn-tracker-on']}`}
            src="images/icons/512x512/btn_power.svg" width="36px" height="36px" alt="" />
        </button>
      </div>
    </div>
  </PopupLayout>
}

export const page: PageView = {
  component: PopupPage, bodyClass: styles.document ?? '',
}
