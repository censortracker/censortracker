import { callBackground } from 'Background/background-rpc'
import { getMessage, getUILanguage } from 'Background/i18n'
import type { RegistrySource as Source } from 'Background/registry-source-data'
import { registrySourceDefaults, registrySourceUrls } from 'Background/registry-source-data'
import { useState } from 'preact/hooks'

import { Button } from '../../components/button'
import { Check, Field, SettingsSection } from '../../components/form'
import { useAction, useResource } from '../../hooks/async'
import { usePageError } from '../../hooks/errors'
import styles from '../../styles/options.module.scss'

export const RegistrySource = () => {
  const { value, error: readError, refresh } =
    useResource(() => callBackground('registrySourceState'))
  const [edited, setDraft] = useState<Source>()
  const draft = edited ?? value?.source ?? registrySourceDefaults
  const { busy, error, run } = useAction()

  usePageError(readError)
  const save = (download: boolean) => run(async () => {
    await callBackground('updateRegistrySource', { ...draft, url: draft.url.trim() })
    if (download) {
      await callBackground('refreshRegistrySource')
    }
  }, async () => {
    await refresh()
    setDraft(undefined)
  })

  return <SettingsSection class={`${styles.option} ${styles['settings-section']}`}
    id="registrySourceOptions" title="registrySourceTitle" open>
    <p class={styles['main-page__about']}>{getMessage('registrySourceHelp')}</p>
    <form id="registrySourceForm" onSubmit={(event) => {
      event.preventDefault()
      save(false)
    }}>
      <Field id="registrySourceKind" title="registrySourceKind">
        <select id="registrySourceKind" value={draft.kind} disabled={busy}
          onChange={(event) => {
            const kind = event.currentTarget.value === 'anticensority'
              ? 'anticensority' : 'custom'

            setDraft({
              kind,
              url: kind === 'custom' ? '' : registrySourceUrls[kind],
              enabled: false,
              autoUpdate: false,
            })
          }}>
          <option value="custom">{getMessage('registrySourceCustom')}</option>
          <option value="anticensority">Anticensority</option>
        </select>
      </Field>
      <p id="registrySourceAnticensority" class={styles['main-page__about']}
        hidden={draft.kind !== 'anticensority'}>{getMessage('registrySourceAnticensority')}</p>
      <Field id="registrySourceUrl" title="registrySourceUrl">
        <input id="registrySourceUrl" type="url" class={styles['input-proxy']}
          maxLength={4096} autoComplete="off" placeholder="https://"
          disabled={busy} readOnly={draft.kind !== 'custom'} value={draft.url}
          onInput={(event) => setDraft({
            ...draft, url: event.currentTarget.value,
          })} />
      </Field>
      <Check id="registrySourceEnabled" title="registrySourceEnabled"
        checked={draft.enabled} disabled={busy}
        onChange={(enabled) => setDraft({ ...draft, enabled })} />
      <Check id="registrySourceAutoUpdate" title="registrySourceAutoUpdate"
        checked={draft.autoUpdate} disabled={busy}
        onChange={(autoUpdate) => setDraft({ ...draft, autoUpdate })} />
      <div class={styles['settings-actions']}>
        <Button type="submit" id="registrySourceSave" disabled={busy || !value}>
          {getMessage('saveCustomProxyButton')}
        </Button>
        <button type="button" id="registrySourceRefresh" disabled={busy || !value}
          onClick={() => save(true)}>{getMessage('registrySourceRefresh')}</button>
      </div>
    </form>
    <p id="registrySourceStatus" role="status">{value && getMessage('registrySourceStatus', [
      String(value.count), value.updatedAt
        ? new Date(value.updatedAt).toLocaleString(getUILanguage())
        : getMessage('registrySourceNotDownloaded'),
    ])}</p>
    <p id="registrySourceError" role="alert" hidden={!error}>
      {getMessage('registrySourceError')}
    </p>
  </SettingsSection>
}
