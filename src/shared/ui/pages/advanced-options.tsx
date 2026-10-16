import { callBackground } from 'Background/background-rpc'
import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'
import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'

import { Button } from '../components/button'
import { ConsentStatus } from '../components/consent-status'
import { Dialog } from '../components/dialog'
import { Check } from '../components/form'
import { settingsDocument, SettingsHeader, SettingsLayout } from '../components/layout'
import { RegistryStatus } from '../components/registry-status'
import { useAction, useResource } from '../hooks/async'
import { usePageError } from '../hooks/errors'
import { useKeySequence } from '../hooks/key-sequence'
import type { PageView } from '../routes'
import styles from '../styles/options.module.scss'
import { SiteRules } from './advanced-options/site-rules'
import { exportFile, importSettings } from './settings-operations'

const Operation = ({ id, title, busy, onClick, children }: {
  id: string
  title: string
  busy: boolean
  onClick: () => void
  children?: ComponentChildren
}) => <div class={styles.option}>
  <button type="button" id={id} disabled={busy} onClick={onClick}
    class={`${styles.option__link} ${styles['settings-link']}`}>
    {getMessage(`${title}Title`)}
  </button>
  <div class={styles['main-page__about']}>{getMessage(`${title}Desc`)}</div>
  {children}
</div>

export const AdvancedOptionsPage = () => {
  const [extended, setExtended] = useState(false)
  const [reset, setReset] = useState(false)
  const [complete, setComplete] = useState(false)
  const [debug, setDebug] = useState(false)
  const [info, setInfo] = useState('')
  const [copied, setCopied] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const { busy, error, run } = useAction()
  const { value, error: readError, refresh } = useResource(() =>
    browser.storage.local.get({ proxyAll: false }))

  useKeySequence(() => {
    setExtended(true)
  })
  useEffect(() => () => clearTimeout(timer.current), [])
  usePageError(error || readError)

  return <>
    <SettingsLayout linkedImage>
      <SettingsHeader title="advancedOptionsTitle" />
      <ConsentStatus advanced />
      <div class={styles.option} id="extendedSettings" hidden={!extended}>
        <Check id="proxyAll" title="proxyAll" checked={value?.proxyAll || false}
          disabled={busy}
          onChange={(checked) => run(() => callBackground('setProxyAll', checked), refresh)} />
      </div>
      <SiteRules />
      <Operation id="importSettings" title="importSettings" busy={false}
        onClick={() => input.current?.click()}>
        <input id="importSettingsInput" ref={input}
          hidden accept="application/json" type="file"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0]

            event.currentTarget.value = ''
            run(() => importSettings(file))
          }} />
      </Operation>
      <Operation id="exportSettings" title="exportSettings" busy={busy}
        onClick={() => run(() => exportFile(false))} />
      <Operation id="exportSupport" title="exportSupport" busy={busy}
        onClick={() => run(() => exportFile(true))} />
      <Operation id="updateLocalRegistry" title="updateLocalRegistry" busy={busy}
        onClick={() => run(async () => {
          setComplete(false)
          await callBackground('updateRegistry')
          setComplete(true)
        })}>
        <RegistryStatus />
      </Operation>
      <Operation id="resetSettingsToDefault" title="resetToDefault" busy={false}
        onClick={() => setReset(!reset)} />
      <Operation id="showDebugInfo" title="showDebugInfo" busy={busy}
        onClick={() => run(async () => {
          setInfo(JSON.stringify(await callBackground('diagnosticInfo'), null, 2))
          setCopied(false)
          setDebug(!debug)
        })} />
    </SettingsLayout>
    <Dialog id="popupConfirmReset" closeId="closePopupReset" open={reset}
      onClose={() => setReset(false)}
      title="areYouSureYouWantToResetSettingsTitle">
      <div class={styles['popup-text']}>{getMessage('areYouSureYouWantToResetSettingsDesc')}</div>
      <Button id="confirmReset" disabled={busy}
        onClick={() => run(async () => {
          setComplete(false)
          try {
            await callBackground('resetSettings')
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
        <textarea readOnly id="debugInfoJSON" class={styles['debug-info']} value={info} />
      </div>
      <Button id="copyDebugInfoBtn" onClick={() => run(async () => {
        await navigator.clipboard.writeText(info)
        setCopied(true)
        clearTimeout(timer.current)
        timer.current = window.setTimeout(() => setDebug(false), 500)
      })}>{copied ? '✓' : <span class={styles.btn__text}>{getMessage('copyButton')}</span>}</Button>
    </Dialog>
  </>
}

export const page: PageView = {
  component: AdvancedOptionsPage, bodyClass: settingsDocument,
}
