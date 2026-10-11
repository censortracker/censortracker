import { callBackground } from 'Background/background-rpc'
import { getMessage } from 'Background/i18n'
import { MAX_IMPORT_BYTES } from 'Background/proxy-import'
import { useRef, useState } from 'preact/hooks'

import { Check, Field, SettingsSection } from '../../components/form'
import { useAction, useResource } from '../../hooks/async'
import styles from '../../styles/options.module.scss'
import { ProtocolOptions } from './protocol-options'

interface ImportResult {
  added?: number;
  skipped?: number;
  truncated?:
  boolean;
  fromPac?: boolean
}

export const ProxyImport = ({ refreshProxies }: {
  refreshProxies: () =>
  Promise<unknown>
}) => {
  const { value, refresh } = useResource(() => callBackground('subscriptions', { operation: 'list' }))
  const { busy, run } = useAction()
  const [text, setText] = useState('')
  const [url, setUrl] = useState('')
  const [protocol, setProtocol] = useState('HTTPS')
  const [status, setStatus] = useState('')
  const file = useRef<HTMLInputElement>(null)
  const execute = (
    action: () => Promise<ImportResult | object | undefined>,
  ) => run(async () => {
    setStatus(getMessage('proxyImportWorking'))
    try {
      const result = await action() as ImportResult | undefined
      let message = result?.added === undefined ? '' : getMessage('proxyImportResult', [
        String(result.added), String(result.skipped),
      ])

      if (result?.truncated) {
        message += ` ${getMessage('proxyImportLimit')}`
      }
      if (result?.fromPac) {
        message += ` ${getMessage('proxyPacWarning')}`
      }
      setStatus(message)
      await refreshProxies()
    } catch {
      setStatus(getMessage('proxyImportFailed'))
    } finally {
      await refresh()
    }
  })

  return <SettingsSection id="proxyImportOptions" title="proxyImportTitle">
    <p class={styles['main-page__about']}>{getMessage('proxyImportPrivacy')}</p>
    <p class={styles['main-page__about']}>{getMessage('proxyPacWarning')}</p>
    <Field id="proxyImportProtocol" title="proxyImportProtocol">
      <select id="proxyImportProtocol" value={protocol} disabled={busy}
        onChange={(event) =>
          setProtocol(event.currentTarget.value)}><ProtocolOptions /></select>
    </Field>
    <Field id="proxyImportText" title="proxyImportText">
      <textarea id="proxyImportText" rows={5} spellcheck={false} maxLength={33554432}
        disabled={busy} value={text} onInput={(event) =>
          setText(event.currentTarget.value)} />
    </Field>
    <Field id="proxyImportFile" title="proxyImportFile">
      <input id="proxyImportFile" ref={file} type="file" accept=".txt,.list,.pac" disabled={busy} />
    </Field>
    <div class={styles['settings-actions']}>
      <button type="button" id="proxyImportButton" disabled={busy} onClick={() => execute(async () => {
        const selected = file.current?.files?.[0]

        if (selected && selected.size > MAX_IMPORT_BYTES) {
          throw new Error('Proxy file is too large')
        }
        return callBackground('importProxies', {
          text: selected ? await selected.text() : text,
          pac: Boolean(selected?.name.toLowerCase().endsWith('.pac')),
          protocol,
        })
      })}>{getMessage('proxyImportButton')}</button>
    </div>
    <Field id="proxyImportUrl" title="proxyImportUrl">
      <input id="proxyImportUrl" type="url" class={styles['input-proxy']}
        placeholder="https://" maxLength={4096} autoComplete="off" disabled={busy}
        value={url} onInput={(event) => setUrl(event.currentTarget.value)} />
    </Field>
    <div class={styles['settings-actions']}>
      <button type="button" id="proxyImportUrlButton" disabled={busy}
        onClick={() => execute(() => callBackground('importProxies', { url: url.trim(), protocol }))}>
        {getMessage('proxyImportButton')}
      </button>
      <button type="button" id="proxySubscribeButton" disabled={busy}
        onClick={() => execute(() => callBackground('subscriptions', {
          operation: 'add', url: url.trim(), protocol,
        }))}>{getMessage('proxySubscribe')}</button>
    </div>
    <Check id="proxySubscriptionsEnabled" title="proxySubscriptionsEnabled"
      disabled={busy} checked={value?.proxySubscriptionsEnabled || false}
      onChange={(enabled) => execute(() => callBackground('subscriptions', { operation: 'enable', enabled }))} />
    <ul id="proxySubscriptions" class={styles['settings-list']}>
      {value?.proxySubscriptions.map((source) => <li key={source.id}>
        <span>{`${source.protocol} — ${new URL(source.url).hostname} `}</span>
        <button type="button" disabled={busy} onClick={() => execute(() =>
          callBackground('refreshSubscription', { id: source.id }))}>{getMessage('proxyRefresh')}</button>
        <button type="button" disabled={busy} onClick={() => execute(() =>
          callBackground('subscriptions', { operation: 'remove', id: source.id }))}>{getMessage('proxyDelete')}</button>
      </li>)}
    </ul>
    <p class={styles['main-page__about']}>{getMessage('proxyAntizapretHelp')}</p>
    <button type="button" id="proxyAntizapretImport" disabled={busy}
      onClick={() => execute(() => callBackground('importAntizapret'))}>{getMessage('proxyAntizapretImport')}</button>
    <p id="proxyImportStatus" role="status">{status}</p>
  </SettingsSection>
}
