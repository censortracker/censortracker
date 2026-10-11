import { callBackground } from 'Background/background-rpc'
import { getMessage, getUILanguage } from 'Background/i18n'
import type { ProxyListAction } from 'Background/proxy-list'
import type { ProxyRecord } from 'Background/proxy-record'
import { useState } from 'preact/hooks'

import { Field, SettingsSection } from '../../components/form'
import { useAction, useResource } from '../../hooks/async'
import { usePageError } from '../../hooks/errors'
import styles from '../../styles/options.module.scss'
import { ProxyChecks } from './checks'
import type { ProxyFilters } from './filter'
import { checkedCountry, filterProxies } from './filter'
import { ProxyForm } from './form'
import { ProxyImport } from './import'
import { ProxyRow } from './row'

export const ProxyList = ({ hidden }: { hidden: boolean }) => {
  const { value, error: readError, refresh } = useResource(async () => {
    const state = await callBackground('proxies', { operation: 'list' })
    const { checks } = await callBackground('proxyCheckState')

    return { ...state, checks }
  })

  usePageError(readError)
  const { busy, run } = useAction()
  const [error, setError] = useState(false)
  const [editing, setEditing] = useState<ProxyRecord>()
  const [revision, setRevision] = useState(0)
  const [page, setPage] = useState(0)
  const [filters, setFilters] = useState<ProxyFilters>({ serverCountry: '', exitCountry: '', sort: '' })
  const reset = () => {
    setEditing(undefined)
    setRevision((current) => current + 1)
  }
  const execute = (args: ProxyListAction) => run(async () => {
    setError(false)
    try {
      await callBackground('proxies', args)
      await refresh()
      if (args.operation === 'save' || args.operation === 'remove') {
        reset()
      }
    } catch {
      setError(true)
    }
  })
  const catalog = value ? [value.builtin, ...value.proxies] : []
  const checks = value?.checks || {}
  const selected = new Set(value?.selectedProxyIds || [])
  const selectedNames = catalog.filter(({ id }) => selected.has(id))
    .map(({ name }) => name)
  let summary = selectedNames.slice(0, 3).join(', ') || getMessage('proxyNoneSelected')

  if (selectedNames.length > 3) {
    summary += ` (+${selectedNames.length - 3})`
  }
  const visible = filterProxies(catalog, checks, filters)
  const lastPage = Math.max(0, Math.floor((visible.length - 1) / 100))
  const currentPage = Math.max(0, Math.min(page, lastPage))
  const names = new Intl.DisplayNames([getUILanguage()], { type: 'region' })
  const countries = (field: 'serverCountry' | 'exitCountry') => {
    const codes = new Set(catalog.map(({ id }) => checkedCountry(checks[id],
      field)))

    if (filters[field]) {
      codes.add(filters[field])
    }
    return Array.from(codes).sort()
  }
  const filter = (key: keyof ProxyFilters, next: string) => {
    setFilters((previous) => ({ ...previous, [key]: next }))
    setPage(0)
  }

  return <>
    <p id="proxySelectionSummary" class={styles['main-page__about']} hidden={hidden}>{summary}</p>
    <SettingsSection id="proxyListOptions" title="proxyManage" summaryId="proxyManageTitle" hidden={hidden}>
      <p class={styles['main-page__about']}>{getMessage('proxyPoolHelp')}</p>
      <SettingsSection id="proxyFilters" title="proxyFilters">
        <div class={styles['settings-grid']}>
          {(['serverCountry', 'exitCountry'] as const).map((key, index) => {
            const id = index ? 'proxyFilterExit' : 'proxyFilterServer'

            return <Field id={id} title={index ? 'proxyExitCountry' : 'proxyServerCountry'} key={key}>
              <select id={id} name={key} disabled={busy} value={filters[key]}
                onChange={(event) => filter(key, event.currentTarget.value)}>
                <option value="">{getMessage('proxyFilterAny')}</option>
                {countries(key).map((code) => <option value={code} key={code}>
                  {code === '?' ? getMessage('proxyFilterUnknown') : `${names.of(code)} (${code})`}
                </option>)}
              </select>
            </Field>
          })}
        </div>
        <Field id="proxySort" title="proxySort">
          <select id="proxySort" name="sort" disabled={busy} value={filters.sort}
            onChange={(event) => filter('sort', event.currentTarget.value)}>
            {[
              ['', 'proxySortDefault'], ['name', 'proxySortName'], ['latency', 'proxySortLatency'],
              ['serverCountry', 'proxyServerCountry'], ['exitCountry', 'proxyExitCountry'],
            ].map(([key, label]) => <option value={key}
              key={key}>{getMessage(label)}</option>)}
          </select>
        </Field>
        <p id="proxyFilteredCount" role="status">{getMessage('proxyFilteredCount', [String(visible.length), String(catalog.length)])}</p>
        <button type="button" id="proxyRemoveFiltered"
          disabled={busy || !visible.some(({ id }) => id !== 'builtin')} onClick={() => {
            const ids = visible.filter(({ id }) => id !== 'builtin').map(({ id }) => id)

            // Confirm deletion of all matching records, including other pages.
            // eslint-disable-next-line no-alert
            if (ids.length > 0 && window.confirm(getMessage('proxyRemoveConfirm', String(ids.length)))) {
              execute({ operation: 'remove', ids })
            }
          }}>{getMessage('proxyRemoveFiltered')}</button>
      </SettingsSection>
      <div class={styles['proxy-table-scroll']} tabIndex={0} role="region" aria-labelledby="proxyManageTitle">
        <table class={styles['proxy-table']}>
          <thead><tr>{['proxySelected', 'proxyName', 'proxyAddress', 'proxyCheckResult', 'proxyActions']
            .map((key) => <th key={key}>{getMessage(key)}</th>)}</tr></thead>
          <tbody id="proxyRows">{visible.slice(currentPage * 100, (currentPage + 1) * 100).map((proxy) =>
            <ProxyRow key={proxy.id} proxy={proxy} check={checks[proxy.id]}
              selected={selected.has(proxy.id)}
              busy={busy} run={execute}
              edit={(record) => setEditing({ ...record })} />)}</tbody>
        </table>
      </div>
      <p id="proxyNoMatches" class={styles['main-page__about']} hidden={visible.length > 0}>
        {getMessage('proxyNoMatches')}
      </p>
      <div id="proxyPagination" class={styles['settings-actions']} hidden={visible.length <= 100}>
        <button type="button" id="proxyPrevious" disabled={busy || currentPage === 0}
          onClick={() => setPage((previous) =>
            Math.max(0, Math.min(previous, lastPage) - 1))}>
          {getMessage('proxyPrevious')}</button>
        <button type="button" id="proxyNext" disabled={busy || (currentPage + 1) * 100 >= visible.length}
          onClick={() => setPage((previous) =>
            Math.min(lastPage, previous + 1))}>
          {getMessage('proxyNext')}</button>
      </div>
      <p id="proxyListError" role="alert" hidden={!error}>{error && getMessage('proxyListInvalid')}</p>
      <ProxyChecks refreshProxies={refresh} />
      <ProxyForm editing={editing} revision={revision} busy={busy}
        save={execute}
        cancel={reset} invalid={() => setError(true)} />
      <ProxyImport refreshProxies={refresh} />
    </SettingsSection>
  </>
}
