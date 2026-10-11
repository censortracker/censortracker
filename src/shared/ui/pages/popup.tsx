import { callBackground } from 'Background/background-rpc'
import browser from 'Background/browser-api'
import { hasDataConsent } from 'Background/data-consent'
import { getMessage } from 'Background/i18n'
import ProxyManager from 'Background/proxy'
import Settings from 'Background/settings'
import { useEffect, useState } from 'preact/hooks'

import { ConsentStatus } from '../components/consent-status'
import { RichMessage } from '../components/message'
import { Notices } from '../components/notices'
import { PageError } from '../components/page-error'
import { PopupLayout } from '../components/popup-layout'
import { usePrivateBrowsing } from '../components/private-browsing'
import { useResource, useStorageChanges } from '../hooks/async'
import { useKeySequence } from '../hooks/key-sequence'
import { navigate } from '../navigation'
import styles from '../styles/popup.module.scss'
import { InfoBlock } from './popup/info-block'
import { ProxyInfo } from './popup/proxy-info'
import { RelatedDomains } from './popup/related-domains'
import { readPopup } from './popup/state'

export const PopupPage = () => {
  useKeySequence()
  const { value, error } = useResource(readPopup)
  const { allowed, failure, status } = usePrivateBrowsing()
  const [actions, setActions] = useState(false)
  const [details, setDetails] = useState('')
  const [choice, setChoice] = useState('auto')
  const state = value?.consent ? value : undefined

  useEffect(() => {
    if (state) {
      setChoice(state.choice)
    }
  }, [state])
  useStorageChanges((changes) => {
    if (['useLocalProxy', 'localProxyAlive', 'useProxy', 'dataConsent'].some((key) =>
      changes[key] && changes[key].newValue !== changes[key].oldValue)) {
      window.location.reload()
    }
  })
  const enable = async () => {
    if (!await hasDataConsent()) {
      await callBackground('openDataConsent')
      return
    }
    await Settings.enableExtension()
    await Settings.enableNotifications()
    await ProxyManager.enableProxy()
    window.location.reload()
  }
  const disable = async () => {
    await Settings.disableExtension()
    window.location.reload()
  }
  const toggleDetails = (id: string) => setDetails(details === id ? '' : id)
  const warning = Boolean(state?.disseminator.url &&
    !state.disseminator.cooperationRefused)
  let disseminatorDescription = 'notDisseminatorDesc'

  if (state?.disseminator.url) {
    disseminatorDescription = state.disseminator.cooperationRefused
      ? 'disseminatorCoopRefused' : 'disseminatorDesc'
  }
  const hideInfo = !state?.enabled || actions || Boolean(state.network)
  const choiceKey = { auto: 'Auto', always: 'Always', never: 'Never' }[choice]
  const image = value?.consent === false ? 'images/popup/disabled.png'
    : `images/icons/512x512/${state?.image || 'normal'}.png`
  let restrictionTitle = 'notBlockedTitle'
  let restrictionDescription = 'notBlockedDesc'

  if (state?.domain?.blocked || state?.domain?.custom) {
    restrictionTitle = state.domain.blocked ? 'blockedTitle' : 'customProxiedTitle'
    restrictionDescription = state.domain.blocked ? 'blockedDesc' : 'customProxiedDesc'
  }
  const footer = <>
    {[
      ['backendIsIntermittentPopupMessage', 'backendIsIntermittentPopupMessage', state?.backendIsIntermittent,
        () => browser.runtime.openOptionsPage()],
      ['proxyConnectionIssuesButton', 'proxyConnectionIssuesMessage', state?.connectionIssues,
        () => browser.tabs.create({ url: 'https://t.me/censortracker_feedback' })],
      ['controlledByOtherExtensionsButton', 'controlledByOtherExtensionsMessage', state?.controlled,
        () => {
          navigate('/controlled.html')
        }],
    ].map(([id, message, show, click]) => <div class={styles['footer-btn']} id={id as string}
      key={id as string} hidden={!show} onClick={click as () => void}>
      <div>{getMessage(message as string)}</div>
    </div>)}
    <div id="privateBrowsingPermissionsRequiredButton" hidden={allowed !== false}
      onClick={() => {
        navigate('/incognito-required-popup.html')
      }}>
      <div>{getMessage('privateBrowsingPermissionsRequiredMessage')}</div>
    </div>
    {browser.isFirefox && <p hidden={!failure && !status} role={failure ? 'alert' : 'status'}>
      {failure instanceof Error ? failure.message : status}
    </p>}
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
          <div class={styles['censor-tracker__btn']} id="disableExtension" onClick={disable}>
            <img class={styles['image__turn-tracker']} src="images/icons/512x512/btn_stop.svg" width="11px" height="16px" alt="" />
          </div>
        </div>
      </div>
    </div>
  </>

  return <PopupLayout footer={footer} image={<div class={styles['main-page__image']} id="statusImageDiv">
    <img id="statusImage" class={styles.image__status} src={image} width="75px" height="auto" alt="Status" />
    <span id="highlightOptionsIcon" class={styles['red-dot']} hidden={!state?.highlight} />
    <a id="openOptionsPage" class={styles.icon__settings} target="_blank" onClick={() => browser.runtime.openOptionsPage()} />
  </div>}>
    <PageError error={error} />
    <Notices compact />
    <ConsentStatus variant="popup" />
    <div class={`${styles['main-page__title']} ${styles['title-domain']}`} hidden={value?.consent === false}>
      <div class={`${styles['current-domain']} ${styles['title-normal']} ${styles.unselectable} ${warning ? styles['title-ori'] : ''}`}
        id="currentDomainHeader" style={{ fontSize: state?.fontSize }}>
        {state && (state.valid ? state.hostname : getMessage('popupNewTabMessage'))}
      </div>
      <span class={`${styles.icon__site_settings} ${actions ? styles['icon-hide'] : styles['icon-show']}`}
        id="toggleSiteActions" hidden={!state?.valid || !state.enabled || Boolean(state.network)} onClick={() => setActions(!actions)} />
    </div>
    <div class={`${styles['main-page__block']} ${styles['main-page-setting']} ${styles.unselectable}`} id="siteActions" hidden={!actions}>
      <div class={styles.block__title}>{getMessage('siteActionTitle')}</div>
      <div class={styles['site-actions-group']}>
        {[
          ['siteActionAuto', 'auto', 'Auto'], ['siteActionProxy', 'always', 'Always'], ['siteActionIgnore', 'never', 'Never'],
        ].map(([id, mode, label]) => <div class={styles['site-actions-group-item']} key={id}>
          <input id={id} type="radio" name="site-action-radio" value={mode} checked={choice === mode}
            onChange={async () => {
              await callBackground('setSiteChoice', { url: state?.url, choice: mode })
              setChoice(mode)
            }} />
          <label for={id}>{getMessage(`siteActionItemLabel${label}`)}</label>
        </div>)}
      </div>
      <div class={styles.proxy_info} id="siteActionDescription">{getMessage(`siteAction${choiceKey}Desc`)}</div>
      {state?.valid && <RelatedDomains tabId={state.tabId} url={state.url} />}
    </div>
    {['tor', 'i2p'].map((network) => <div class={styles['network-description']} id={`${network}Network`}
      key={network} hidden={!state?.enabled || state.network !== network}>
      <RichMessage as="div" class={styles.network__title} message={`${network}NetworkTitle`} />
      <div class={styles.network__about}>{getMessage('overlayNetworkDesc')}</div>
    </div>)}
    <InfoBlock id="ori" title={warning ? 'disseminatorTitle' : 'notDisseminatorTitle'}
      icon={warning ? 'danger' : 'ok'} warning={warning} hidden={hideInfo}
      open={details === 'ori'} onToggle={() => toggleDetails('ori')}
      description={disseminatorDescription} link="https://blockedin.org/ru/disseminators/" />
    <InfoBlock id="restrictions" title={restrictionTitle}
      icon={state?.domain?.blocked || state?.domain?.custom ? 'info' : 'ok'} hidden={hideInfo}
      open={details === 'restrictions'} onToggle={() => toggleDetails('restrictions')}
      description={restrictionDescription} link="https://blockedin.org/ru/" />
    {state?.enabled && state.hostname && <ProxyInfo url={state.url}
      hidden={hideInfo}
      open={details === 'proxy'} onToggle={() => toggleDetails('proxy')} />}
    <div class={`${styles['main-page__info']} ${styles.unselectable}`} id="extensionIsOff" hidden={!state || state.enabled}>
      <div class={`${styles['main-page__title']} ${styles['title-disabled']}`}>{getMessage('extensionDisabledTitle')}</div>
      <div class={styles['main-page__block']}>
        <div class={`${styles.block__title} ${styles['text-about']} ${styles['block-disabled']}`}>
          <span>{getMessage('turnOnExtensionToCheckWebsite')}</span>
        </div>
        <div class={`${styles['censor-tracker__btn']} ${styles['btn-on']}`} id="enableExtension" onClick={enable}>
          <img class={`${styles['image__turn-tracker']} ${styles['image__turn-tracker-on']}`}
            src="images/icons/512x512/btn_power.svg" width="36px" height="36px" alt="" />
        </div>
      </div>
    </div>
  </PopupLayout>
}
