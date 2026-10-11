import { callBackground } from 'Background/background-rpc'
import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'
import { useEffect, useRef, useState } from 'preact/hooks'

import { Button } from '../components/button'
import { ConsentStatus } from '../components/consent-status'
import { Dialog } from '../components/dialog'
import { Check } from '../components/form'
import { SettingsHeader, SettingsLayout } from '../components/layout'
import { RegistryStatus } from '../components/registry-status'
import { SiteRules } from '../components/site-rules'
import { useAction, useResource } from '../hooks/async'
import { usePageError } from '../hooks/errors'
import { useKeySequence } from '../hooks/key-sequence'
import styles from '../styles/options.module.scss'
import { exportFile, importSettings, resetSettings, updateRegistry } from './settings-operations'

export const AdvancedOptionsPage = () => {
  const [extended, setExtended] = useState(false)
  const [reset, setReset] = useState(false)
  const [complete, setComplete] = useState(false)
  const [debug, setDebug] = useState(false)
  const [info, setInfo] = useState('')
  const [copied, setCopied] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const textarea = useRef<HTMLTextAreaElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const updateAction = useAction()
  const resetAction = useAction()
  const debugAction = useAction()
  const exportAction = useAction()
  const supportAction = useAction()
  const proxyAction = useAction()
  const importAction = useAction()
  const { value, refresh } = useResource(() =>
    browser.storage.local.get({ proxyAll: false }))

  useKeySequence(() => {
    setExtended(true)
  })
  useEffect(() => () => clearTimeout(timer.current), [])
  const error = updateAction.error || resetAction.error || debugAction.error ||
    exportAction.error || supportAction.error ||
    proxyAction.error || importAction.error
  const operations = [
    {
      id: 'importSettings',
      title: 'importSettings',
      busy: false,
      click: () => input.current?.click(),
    },
    {
      id: 'exportSettings',
      title: 'exportSettings',
      busy: exportAction.busy,
      click: () => exportAction.run(() => exportFile(false)),
    },
    {
      id: 'exportSupport',
      title: 'exportSupport',
      busy: supportAction.busy,
      click: () => supportAction.run(() => exportFile(true)),
    },
    {
      id: 'updateLocalRegistry',
      title: 'updateLocalRegistry',
      busy: updateAction.busy,
      click: () => updateAction.run(async () => {
        setComplete(false)
        await updateRegistry()
        setComplete(true)
      }),
    },
    {
      id: 'resetSettingsToDefault',
      title: 'resetToDefault',
      busy: false,
      click: () => setReset(!reset),
    },
    {
      id: 'showDebugInfo',
      title: 'showDebugInfo',
      busy: debugAction.busy,
      click: () => debugAction.run(async () => {
        setInfo(JSON.stringify(await callBackground('diagnosticInfo'), null, 2))
        setCopied(false)
        setDebug(!debug)
      }),
    },
  ]

  usePageError(error)

  return <>
    <SettingsLayout linkedImage>
      <SettingsHeader title="advancedOptionsTitle" />
      <ConsentStatus variant="advanced" />
      <div class={styles.option} id="extendedSettings" hidden={!extended}>
        <Check id="proxyAll" title="proxyAll" checked={value?.proxyAll || false}
          disabled={proxyAction.busy}
          onChange={(checked) => proxyAction.run(async () => {
            try {
              await callBackground('setProxyAll', checked)
            } finally {
              await refresh()
            }
          })} />
      </div>
      <SiteRules />
      {operations.map(({ id, title, busy, click }) =>
        <div class={styles.option} key={id}>
          <button type="button" id={id} disabled={busy} onClick={click}
            class={`${styles.option__link} ${styles['settings-link']}`}>
            {getMessage(`${title}Title`)}
          </button>
          <div class={styles['main-page__about']}>{getMessage(`${title}Desc`)}</div>
          {id === 'importSettings' && <input id="importSettingsInput" ref={input}
            class={styles.hidden} accept="application/json" type="file"
            onChange={(event) => {
              const file = event.currentTarget.files?.[0]

              event.currentTarget.value = ''
              importAction.run(() => importSettings(file))
            }} />}
          {id === 'updateLocalRegistry' && <RegistryStatus />}
        </div>)}
    </SettingsLayout>
    <Dialog id="popupConfirmReset" closeId="closePopupReset" open={reset}
      onClose={() => setReset(false)}
      title="areYouSureYouWantToResetSettingsTitle">
      <div class={styles['popup-text']}>{getMessage('areYouSureYouWantToResetSettingsDesc')}</div>
      <Button id="confirmReset" disabled={resetAction.busy}
        onClick={() => resetAction.run(async () => {
          setComplete(false)
          try {
            await resetSettings()
            setComplete(true)
          } finally {
            setReset(false)
          }
        })}><span class={styles.btn__text}>{getMessage('confirmPopupResetSettings')}</span></Button>{' '}
      <Button id="cancelPopupReset" variant="light" onClick={() => setReset(false)}>
        <span class={styles.btn__text}>{getMessage('cancel')}</span>
      </Button>
    </Dialog>
    <Dialog id="popupCompletedSuccessfully" closeId="closePopupConfirm"
      open={complete} onClose={() => setComplete(false)} title="done">
      <div class={styles['popup-text']}>{getMessage('doneDescription')}</div>
      <Button id="completedConfirm" onClick={() => setComplete(false)}>
        <span class={styles.btn__text}>{getMessage('good')}</span>
      </Button>
    </Dialog>
    <Dialog id="popupDebugInformation" closeId="closeDebugInfo" open={debug}
      onClose={() => setDebug(false)} title="debugInfoTitle">
      <div class={styles['popup-text']}>
        <textarea readOnly id="debugInfoJSON" ref={textarea} value={info} />
      </div>
      <Button id="copyDebugInfoBtn" onClick={() => {
        textarea.current?.select()
        document.execCommand('copy')
        setCopied(true)
        clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setDebug(false), 500)
      }}>{copied ? '✓' : <span class={styles.btn__text}>{getMessage('copyButton')}</span>}</Button>
    </Dialog>
  </>
}
