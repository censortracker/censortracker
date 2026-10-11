import { callBackground } from 'Background/background-rpc'
import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'
import { useEffect, useRef } from 'preact/hooks'

import { Check, SettingsSection } from '../../components/form'
import { useAction, useLatest, useResource, useStorageChanges } from '../../hooks/async'
import { usePageError } from '../../hooks/errors'
import styles from '../../styles/options.module.scss'

export const ProxyRecovery = () => {
  const { value, error: readError, refresh } = useResource(() =>
    browser.storage.local.get({
      proxyRecoveryEnabled: false,
    }), ['proxyRecoveryEnabled'])
  const { busy, error, run } = useAction()

  usePageError(error || readError)

  return <Check id="proxyRecoveryEnabled" title="proxyRecoveryEnabled"
    checked={value?.proxyRecoveryEnabled || false} disabled={busy}
    onChange={(checked) => run(async () => {
      try {
        await callBackground('setProxyRecovery', checked)
      } finally {
        await refresh()
      }
    })} />
}

export const ProxyChecks = ({ refreshProxies }: {
  refreshProxies: () =>
  Promise<unknown>
}) => {
  const { value, error: readError, refresh } = useResource(
    () => callBackground('proxyCheckState'), ['proxyCheckRun'],
  )
  const { busy, error, run } = useAction()
  const timer = useRef<number | null>(null)
  const refreshCatalog = useLatest(refreshProxies)

  useStorageChanges((changes) => {
    if (changes.proxyChecks && timer.current === null) {
      timer.current = window.setTimeout(() => {
        timer.current = null
        refreshCatalog.current()
      }, 300)
    }
  })
  useEffect(() => () => {
    if (timer.current !== null) {
      clearTimeout(timer.current)
    }
  }, [])
  const start = (onlySelected: boolean) => run(async () => {
    const { selectedProxyIds } = await callBackground('proxies', { operation: 'list' })

    await callBackground('startProxyChecks', onlySelected ? { ids: selectedProxyIds } : {})
    await refresh()
  })
  const state = value?.run
  let status = state?.total === undefined ? '' : getMessage('proxyCheckProgress', [
    String(state.completed || 0), String(state.total),
  ])

  if (state?.cancelled) {
    status += ` ${getMessage('proxyCheckCancelled')}`
  }
  return <SettingsSection id="proxyCheckOptions" title="proxyCheckTitle">
    <p class={styles['main-page__about']}>{getMessage('proxyCheckPrivacy')}</p>
    <div class={styles['settings-actions']}>
      <button type="button" id="proxyCheckSelected" disabled={busy || state?.running}
        onClick={() => start(true)}>{getMessage('proxyCheckSelected')}</button>
      <button type="button" id="proxyCheckAll" disabled={busy || state?.running}
        onClick={() => start(false)}>{getMessage('proxyCheckAll')}</button>
      <button type="button" id="proxyCheckStop" disabled={busy || !state?.running}
        onClick={() => run(async () => {
          await callBackground('stopProxyChecks')
          await refresh()
        })}>{getMessage('proxyCheckStop')}</button>
    </div>
    <p id="proxyCheckStatus" role="status">{status}</p>
    <p id="proxyCheckError" role="alert" hidden={!error && !readError}>
      {getMessage('proxyCheckError')}
    </p>
  </SettingsSection>
}
