import { callBackground } from 'Background/background-rpc'
import browser from 'Background/browser-api'
import { getMessage } from 'Background/i18n'
import { useRef, useState } from 'preact/hooks'

import { Button } from '../../components/button'
import { Field, SettingsSection } from '../../components/form'
import { countryLabel } from '../../country'
import { useAction, useResource } from '../../hooks/async'
import { usePageError } from '../../hooks/errors'
import styles from '../../styles/options.module.scss'

export const SiteRules = () => {
  const { value, error: readError, refresh } = useResource(() =>
    browser.storage.local.get({ siteCountryRules: {} }))
  const [host, setHost] = useState('')
  const [countries, setCountries] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const { busy, error, run } = useAction()

  usePageError(readError)
  const save = (hostname: string, codes: string[] | null) => run(async () => {
    await callBackground('siteCountryRule', { host: hostname, countries: codes })
    setHost('')
    setCountries('')
  }, refresh)

  return <SettingsSection class={`${styles.option} ${styles['settings-section']}`}
    id="siteRuleOptions" title="siteRulesTitle">
    <p class={styles['main-page__about']}>{getMessage('siteRulesHelp')}</p>
    <form id="siteRuleForm" onSubmit={(event) => {
      event.preventDefault()
      save(host.trim(), countries.toUpperCase().split(/[\s,]+/).filter(Boolean))
    }}>
      <Field id="siteRuleHost" title="siteRuleHost">
        <input id="siteRuleHost" ref={input} class={styles['input-proxy']}
          required maxLength={4096} placeholder="example.com" disabled={busy}
          value={host}
          onInput={(event) => setHost(event.currentTarget.value)} />
      </Field>
      <Field id="siteRuleCountries" title="siteRuleCountries">
        <input id="siteRuleCountries" class={styles['input-proxy']} maxLength={2028}
          placeholder="RU, CN" disabled={busy} value={countries}
          onInput={(event) => setCountries(event.currentTarget.value)} />
      </Field>
      <div class={styles['settings-actions']}>
        <Button type="submit" id="siteRuleSave" disabled={busy || !value}>
          {getMessage('saveCustomProxyButton')}
        </Button>
      </div>
    </form>
    <p id="siteRuleError" role="alert" hidden={!error}>{getMessage('siteRuleError')}</p>
    <ul id="siteRuleRows" class={styles['settings-list']}>
      {Object.entries(value?.siteCountryRules || {}).map(([hostname, codes]) =>
        <li key={hostname}>
          <span>{`${hostname}: ${codes.length > 0
            ? codes.map(countryLabel).join(', ')
            : getMessage('siteRuleUnrestricted')} `}</span>
          <button type="button" disabled={busy} onClick={() => {
            setHost(hostname)
            setCountries(codes.join(', '))
            input.current?.focus()
          }}>{getMessage('proxyEdit')}</button>
          <button type="button" disabled={busy} onClick={() => save(hostname, null)}>
            {getMessage('proxyDelete')}
          </button>
        </li>)}
    </ul>
  </SettingsSection>
}
